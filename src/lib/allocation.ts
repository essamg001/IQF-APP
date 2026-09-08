import { prisma } from "@/lib/prisma";
import type { Grade, Format, Prisma } from "@prisma/client";
import { bothLabsApprovedFilter } from "@/lib/microbiology";
import { combinedCfuValue, exceedsClientLimit } from "@/lib/cfuTier";
import { evaluateSpecCompliance, violatedSpecRows } from "@/lib/specCompliance";
import { isMrlCleared } from "@/lib/mrl";

/**
 * Best-effort parse of free-text brix specs -- e.g. "8-11%", "8% ± 2.5",
 * "7 - 8.5", "6.0 – 10.0" (en dash), "≥8.0", "Minimum 6 degrees", "6 degrees
 * minimum", "8% (MIN)". `max: null` means open-ended (no ceiling stated).
 *
 * Real client spec sheets overwhelmingly express brix as a floor -- the
 * concern is under-ripe fruit, not fruit that's *sweeter* than the stated
 * minimum -- so an explicit minimum returns an open-ended range rather than
 * clamping the top end to the same number. Previously a bare number with no
 * min/max language (e.g. just "8%") fell through to that same min=max
 * treatment, which meant real specs like "8% (MIN)" or "Minimum 6 degrees"
 * (once the surrounding words were stripped down to their number) silently
 * rejected any pallet sweeter than the floor -- confirmed live: 26 of 34
 * real Grade A Whole client specs would reject a perfectly good 9°Bx pallet
 * this way. A genuinely bare, unqualified number is real ambiguity (could
 * mean floor, ceiling, or exact target) -- returns null (not enforceable,
 * shown for manual review only) rather than guessing, same as this
 * function already does for any other unparseable text.
 *
 * Every branch is anchored to the *start* of the (trimmed) text, not
 * searched for anywhere in it -- a Red/Amber/Green banded spec like
 * "Green (accept): >=8.0; Amber: >=7.0-8.0; Red (reject): <7.0" contains a
 * "7.0-8.0"-shaped substring in its Amber clause that an unanchored search
 * would misread as the whole spec's range (confirmed live: this exact text
 * did precisely that before anchoring). Anchoring at the start still
 * tolerates trailing descriptive text ("6.0 – 10.0 (uncorrected,
 * refractometer)"), but a banded/multi-clause description that doesn't
 * open with a number or comparison symbol correctly falls through to
 * null, same as the class-level doc comment already says banded specs
 * should.
 */
export function parseBrixRange(text: string | null | undefined): { min: number; max: number | null } | null {
  if (!text) return null;
  const t = text.trim();
  if (t === "*") return null;

  const rangeMatch = t.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }

  const toleranceMatch = t.match(/^(\d+(?:\.\d+)?)\s*%?\s*±\s*(\d+(?:\.\d+)?)/);
  if (toleranceMatch) {
    const center = Number(toleranceMatch[1]);
    const tolerance = Number(toleranceMatch[2]);
    return { min: center - tolerance, max: center + tolerance };
  }

  let m = t.match(/^(?:≥|>=|>)\s*(\d+(?:\.\d+)?)/);
  if (m) return { min: Number(m[1]), max: null };
  m = t.match(/^at least\s*(\d+(?:\.\d+)?)/i);
  if (m) return { min: Number(m[1]), max: null };
  m = t.match(/^min(?:imum)?\b[^\d]*(\d+(?:\.\d+)?)/i);
  if (m) return { min: Number(m[1]), max: null };
  m = t.match(/^(\d+(?:\.\d+)?)[^\d]*\bmin(?:imum)?\b/i);
  if (m) return { min: Number(m[1]), max: null };

  return null;
}

/**
 * Picks pallets for an order. Meeting the client's spec is a pass/fail bar,
 * not something to optimize past -- once a pallet is compliant, reaching
 * for the single "best" one instead of the oldest one just skims the best
 * stock first and leaves progressively worse (still compliant) stock
 * behind for later orders. So among compliant pallets, plain FIFO decides
 * order, with two consolidation preferences layered on top (neither is
 * about quality, both are about touching as little of the warehouse as
 * possible): stay within one production lot where a single lot can cover
 * the order (clients prefer consistent characteristics / a simpler
 * certificate of analysis), and within that lot, stay within one storage
 * line (easier for the driver/supervisor loading it).
 */
export async function suggestAllocation(
  params: {
    clientId: string;
    grade: Grade;
    format: Format;
    quantity: number;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const { clientId, grade, format, quantity } = params;

  const spec = await client.clientSpec.findFirst({
    where: { clientId, grade, format },
  });

  const allEligiblePallets = await client.pallet.findMany({
    where: {
      status: "IN_STORAGE",
      // A pallet gets its Pallet row at Post-Freeze Inspection, tied to a
      // lot, before it's ever actually packed -- packingDate is only set
      // once Final Product Entry runs for it. Until then it has no real
      // carton count/weight/packing details, so it isn't ready to promise
      // to a client even though its lot may already be lab-cleared.
      packingDate: { not: null },
      lot: { grade, format, shift: { is: { onHold: false } }, ...bothLabsApprovedFilter },
    },
    include: { lot: { include: { qualityChecks: true, microbiologyResults: true, mrlResult: true } }, slot: true },
    orderBy: { createdAt: "asc" },
  });

  // The pallet's own POST_PACKAGING check, falling back to the lot's latest
  // one -- same lookup already used by src/lib/palletQuality.ts, so a
  // pallet-specific check always wins over a lot-level one when both exist.
  const latestPostPackagingCheck = (palletId: string, lotId: string) => {
    const forPallet = allEligiblePallets
      .find((p) => p.id === palletId)
      ?.lot.qualityChecks.filter((c) => c.checkpoint === "POST_PACKAGING" && c.palletId === palletId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (forPallet) return forPallet;
    return allEligiblePallets
      .find((p) => p.lotId === lotId)
      ?.lot.qualityChecks.filter((c) => c.checkpoint === "POST_PACKAGING" && !c.palletId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  };

  // A pallet can be lab-Approved (both labs signed off) and still fail this
  // specific client's own spec -- cfu/g, brix, or a defect tolerance -- so
  // exclude those up front rather than suggest a pallet that would just get
  // blocked at load-out anyway (see src/lib/cfuTier.ts, src/lib/specCompliance.ts).
  // A pallet with no reading at all isn't excluded -- absence of data isn't
  // evidence it exceeds the limit.
  const eligiblePallets = allEligiblePallets.filter((p) => {
    if (!isMrlCleared(p.lot.mrlResult)) return false;

    const cfuValue = combinedCfuValue(p.lot.microbiologyResults);
    if (cfuValue != null && exceedsClientLimit(cfuValue, spec?.maxCfuPerGram)) return false;

    const check = latestPostPackagingCheck(p.id, p.lotId);
    const complianceRows = evaluateSpecCompliance(check ?? null, spec ?? null);
    if (violatedSpecRows(complianceRows).length > 0) return false;

    return true;
  });

  // FIFO among compliant pallets -- see the doc comment above for why this
  // isn't ranked by brix/defect quality. "score" here is purely the
  // pallet's age (oldest = lowest = picked first); pickClusteredByLotThenLine
  // and pickWithinLotByLine both just sort ascending by it, same as they
  // would for a real quality score, so a lot/line's "repScore" naturally
  // becomes that group's average age instead.
  const scored = eligiblePallets.map((pallet) => ({ pallet, score: pallet.createdAt.getTime() }));

  return pickClusteredByLotThenLine(scored, quantity);
}

type EligiblePallet = Prisma.PalletGetPayload<{
  include: {
    lot: { include: { qualityChecks: true; microbiologyResults: true; mrlResult: true } };
    slot: true;
  };
}>;
type ScoredPallet = { pallet: EligiblePallet; score: number };

// One storage "line" -- a single rack column, every level, within one round
// -- is sized to roughly a container's worth (see ColdRoomSlot's schema
// comment), so pulling a shipment off one line rather than scattered across
// the room is physically much easier for the driver and supervisor loading
// it. A pallet with no shelf assignment yet is its own singleton line
// (nothing to cluster it with).
function lineKey(pallet: EligiblePallet) {
  return pallet.slot ? `${pallet.slot.coldRoomId}::${pallet.slot.round}::${pallet.slot.rack}` : `unassigned::${pallet.id}`;
}

// Within one lot's still-remaining pallets (already in FIFO order), greedily
// exhausts the oldest-still-unpicked pallet's storage line before moving to
// the next-oldest pallet elsewhere in the same lot -- same reasoning as the
// module doc comment on lineKey, just scoped to whichever lot
// pickClusteredByLotThenLine has already chosen.
function pickWithinLotByLine(lotEntries: ScoredPallet[], need: number): EligiblePallet[] {
  // Sorts defensively rather than trusting callers to pass entries already
  // in quality order -- cheap at this scale, and it removes an implicit
  // precondition that silently produced the wrong pick order in an earlier
  // version of this file's own test suite when it was forgotten once.
  lotEntries = [...lotEntries].sort((a, b) => a.score - b.score);
  const remaining = new Set(lotEntries.map((r) => r.pallet.id));
  const picks: EligiblePallet[] = [];

  while (picks.length < need && remaining.size > 0) {
    const anchor = lotEntries.find((r) => remaining.has(r.pallet.id))!;
    const anchorLine = lineKey(anchor.pallet);

    for (const r of lotEntries) {
      if (picks.length >= need) break;
      if (!remaining.has(r.pallet.id)) continue;
      if (lineKey(r.pallet) !== anchorLine) continue;
      picks.push(r.pallet);
      remaining.delete(r.pallet.id);
    }
  }

  return picks;
}

// Clients prefer a shipment drawn from as few production lots as possible
// (consistent characteristics, a simpler certificate of analysis) -- a
// stronger preference than storage-line clustering, since it's a client
// expectation, not just a driver convenience. So lot is the OUTER grouping,
// line-clustering the inner one within whichever lot gets chosen. Neither
// level chases quality -- see suggestAllocation's doc comment -- so "score"
// throughout this function is age (FIFO), and a lot's "repScore" is just
// that lot's average age among the pallets that would actually be used.
//
// Each round: prefer a lot that can supply the ENTIRE remaining need by
// itself, picking the oldest-on-average such lot if more than one
// qualifies. If no single lot can fully cover what's left, prefer the lot
// with the most still-eligible pallets (so the fewest additional lots are
// needed to finish the order), age as the tiebreaker. This can mean
// choosing a lot that isn't home to the single oldest pallet overall, if
// staying within it lets the whole order stay in one lot -- that trade is
// the point.
function pickClusteredByLotThenLine(ranked: ScoredPallet[], quantity: number): EligiblePallet[] {
  ranked = [...ranked].sort((a, b) => a.score - b.score); // see pickWithinLotByLine's comment on why this isn't left implicit
  const remaining = new Set(ranked.map((r) => r.pallet.id));
  const picks: EligiblePallet[] = [];

  while (picks.length < quantity && remaining.size > 0) {
    const need = quantity - picks.length;

    const byLot = new Map<string, ScoredPallet[]>();
    for (const r of ranked) {
      if (!remaining.has(r.pallet.id)) continue;
      const key = r.pallet.lotId;
      if (!byLot.has(key)) byLot.set(key, []);
      byLot.get(key)!.push(r);
    }

    const lots = [...byLot.values()].map((entries) => {
      const count = entries.length;
      const fullyCovers = count >= need;
      const usedCount = fullyCovers ? need : count;
      const repScore = entries.slice(0, usedCount).reduce((s, e) => s + e.score, 0) / usedCount;
      return { entries, count, fullyCovers, repScore };
    });

    lots.sort((a, b) => {
      if (a.fullyCovers !== b.fullyCovers) return a.fullyCovers ? -1 : 1;
      if (a.fullyCovers) return a.repScore - b.repScore; // both cover fully -- oldest-on-average wins
      if (b.count !== a.count) return b.count - a.count; // neither covers fully -- prefer fewer lots to finish
      return a.repScore - b.repScore; // final tiebreak -- oldest-on-average
    });

    const chosenLot = lots[0]!;
    for (const p of pickWithinLotByLine(chosenLot.entries, need)) {
      picks.push(p);
      remaining.delete(p.id);
    }
  }

  return picks;
}

/**
 * suggestAllocation stays silent about *why* it found nothing -- a supervisor
 * seeing "0 pallets allocated" has no way to tell "nothing's ready" apart from
 * "something's broken". Re-runs the same filter stages one at a time, coarsest
 * first, so the first one that comes up empty is the actual bottleneck.
 */
export async function explainZeroAllocation(
  params: { grade: Grade; format: Format },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<"NO_STOCK" | "LAB_PENDING" | "SPEC_FAIL"> {
  const { grade, format } = params;

  const anyMatchingStock = await client.pallet.count({
    where: { status: "IN_STORAGE", lot: { grade, format } },
  });
  if (anyMatchingStock === 0) return "NO_STOCK";

  const labClearedStock = await client.pallet.count({
    where: {
      status: "IN_STORAGE",
      lot: { grade, format, shift: { is: { onHold: false } }, mrlResult: { status: "APPROVED" }, ...bothLabsApprovedFilter },
    },
  });
  if (labClearedStock === 0) return "LAB_PENDING";

  return "SPEC_FAIL";
}

/**
 * How many pallets short the system is, system-wide, for a grade+format --
 * the same "ready minus committed" arithmetic Available-to-Sell uses, pulled
 * out so the order page's NO_STOCK detail can show the real number inline
 * instead of making someone click through to Available-to-Sell just to see
 * it. Returns 0 when there's no shortfall (ready stock covers every pending
 * order, or exceeds it).
 */
export async function getSystemShortfall(
  params: { grade: Grade; format: Format },
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
  const { grade, format } = params;

  const [readyCount, pendingOrders] = await Promise.all([
    client.pallet.count({
      where: {
        status: "IN_STORAGE",
        packingDate: { not: null },
        lot: { grade, format, shift: { is: { onHold: false } }, mrlResult: { status: "APPROVED" }, ...bothLabsApprovedFilter },
      },
    }),
    client.order.findMany({
      where: { grade, format, stage: { in: ["CONFIRMED", "IN_PRODUCTION", "PACKED"] }, cancelledAt: null },
      select: { quantityPallets: true, _count: { select: { pallets: true } } },
    }),
  ]);

  const committed = pendingOrders.reduce((s, o) => s + Math.max(0, o.quantityPallets - o._count.pallets), 0);
  return Math.max(0, committed - readyCount);
}
