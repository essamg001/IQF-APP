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
      if (avgBrix < brixRange.min) score += brixRange.min - avgBrix;
      else if (avgBrix > brixRange.max) score += avgBrix - brixRange.max;
    } else {
      score += 5; // no data — deprioritize vs. known-good matches
    }
    score += avgDefect * 0.1; // mild tiebreaker toward lower logged defects

    return { pallet, score };
  });

  scored.sort((a, b) => a.score - b.score || a.pallet.createdAt.getTime() - b.pallet.createdAt.getTime());

  return pickClusteredByLine(scored, quantity);
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
// it. Walks the quality-ranked list and, from the best still-unpicked
// pallet, greedily takes every other still-eligible pallet already in that
// same line (in the existing quality order) before moving on to the next
// best pallet elsewhere. Line-clustering only ever trades off between
// otherwise-equally-eligible pallets -- it never overrides the quality
// ranking a spec/brix match already produced, since the anchor is always
// literally the next-best pallet not yet picked. A pallet with no shelf
// assignment yet is its own singleton line (nothing to cluster it with).
function lineKey(pallet: EligiblePallet) {
  return pallet.slot ? `${pallet.slot.coldRoomId}::${pallet.slot.round}::${pallet.slot.rack}` : `unassigned::${pallet.id}`;
}

function pickClusteredByLine(ranked: ScoredPallet[], quantity: number): EligiblePallet[] {
  const remaining = new Set(ranked.map((r) => r.pallet.id));
  const picks: EligiblePallet[] = [];

  while (picks.length < quantity && remaining.size > 0) {
    const anchor = ranked.find((r) => remaining.has(r.pallet.id))!;
    const anchorLine = lineKey(anchor.pallet);

    for (const r of ranked) {
      if (picks.length >= quantity) break;
      if (!remaining.has(r.pallet.id)) continue;
      if (lineKey(r.pallet) !== anchorLine) continue;
      picks.push(r.pallet);
      remaining.delete(r.pallet.id);
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
