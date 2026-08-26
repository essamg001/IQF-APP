import { prisma } from "@/lib/prisma";
import type { Grade, Format, Prisma } from "@prisma/client";
import { bothLabsApprovedFilter } from "@/lib/microbiology";
import { combinedCfuValue, exceedsClientLimit } from "@/lib/cfuTier";
import { evaluateSpecCompliance, violatedSpecRows } from "@/lib/specCompliance";
import { isMrlCleared } from "@/lib/mrl";

/** Best-effort parse of free-text brix specs like "8-11%", "8% ± 2.5", "7 - 8.5", or "8.0". */
export function parseBrixRange(text: string | null | undefined): { min: number; max: number } | null {
  if (!text) return null;

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }

  const toleranceMatch = text.match(/(\d+(?:\.\d+)?)\s*%?\s*±\s*(\d+(?:\.\d+)?)/);
  if (toleranceMatch) {
    const center = Number(toleranceMatch[1]);
    const tolerance = Number(toleranceMatch[2]);
    return { min: center - tolerance, max: center + tolerance };
  }

  const singleMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const value = Number(singleMatch[1]);
    return { min: value, max: value };
  }

  return null;
}

/**
 * Picks pallets for an order: FIFO by default. If the client has a spec for
 * this grade + format, ranks eligible lots by brix fit (parsed from the
 * free-text spec) before falling back to FIFO order, with logged defect %
 * as a secondary tiebreaker.
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

  const brixRange = parseBrixRange(spec?.brix);

  // Uniform (score, pallet) ranking -- quality-ranked if a brix spec exists,
  // otherwise 0 for everyone so FIFO alone decides (matches the prior
  // no-spec behavior exactly, just expressed through the same ranking path
  // that line-clustering below also uses).
  const scored = eligiblePallets.map((pallet) => {
    if (!spec || !brixRange) return { pallet, score: 0 };

    const checks = pallet.lot.qualityChecks;
    const avgBrix = checks.length ? checks.reduce((s, c) => s + c.brix, 0) / checks.length : null;
    const avgDefect = checks.length
      ? checks.reduce((s, c) => s + (c.mouldPct ?? 0) + (c.skinDamagePct ?? 0), 0) / checks.length
      : 0;

    let score = 0;
    if (avgBrix !== null) {
      // Distance from the CENTER of the range, not from its edges. A pallet
      // outside the range is already excluded above (see eligiblePallets'
      // spec-compliance check, which uses this exact same range) -- so
      // "distance beyond the edge" can never be positive here in the normal
      // case, and every surviving pallet would score a tying 0 despite one
      // being dead-center and another barely squeaking in at the boundary.
      // Distance-from-center actually differentiates between them.
      const center = (brixRange.min + brixRange.max) / 2;
      score += Math.abs(avgBrix - center);
    } else {
      score += 5; // no data — deprioritize vs. known-good matches
    }
    score += avgDefect * 0.1; // mild tiebreaker toward lower logged defects

    return { pallet, score };
  });

  scored.sort((a, b) => a.score - b.score || a.pallet.createdAt.getTime() - b.pallet.createdAt.getTime());

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

// Within one lot's still-remaining pallets (already in quality order), greedily
// exhausts the best-still-unpicked pallet's storage line before moving to the
// next best pallet elsewhere in the same lot -- same reasoning as the module
// doc comment on lineKey, just scoped to whichever lot pickClusteredByLotThenLine
// has already chosen.
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
// line-clustering the inner one within whichever lot gets chosen.
//
// Each round: prefer a lot that can supply the ENTIRE remaining need by
// itself, picking the best (lowest average score) such lot if more than one
// qualifies. If no single lot can fully cover what's left, prefer the lot
// with the most still-eligible pallets (so the fewest additional lots are
// needed to finish the order), quality as the tiebreaker. This can mean
// choosing a lot that isn't quite the single best pallet's lot, if a
// slightly-lower-scoring lot would let the whole order stay in one lot --
// that trade is the point.
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
      if (a.fullyCovers) return a.repScore - b.repScore; // both cover fully -- best quality wins
      if (b.count !== a.count) return b.count - a.count; // neither covers fully -- prefer fewer lots to finish
      return a.repScore - b.repScore;
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
