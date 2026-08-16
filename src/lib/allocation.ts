import { prisma } from "@/lib/prisma";
import type { Grade, Format } from "@prisma/client";
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
export async function suggestAllocation(params: {
  clientId: string;
  grade: Grade;
  format: Format;
  quantity: number;
}) {
  const { clientId, grade, format, quantity } = params;

  const spec = await prisma.clientSpec.findFirst({
    where: { clientId, grade, format },
  });

  const allEligiblePallets = await prisma.pallet.findMany({
    where: {
      status: "IN_STORAGE",
      lot: { grade, format, shift: { is: { onHold: false } }, ...bothLabsApprovedFilter },
    },
    include: { lot: { include: { qualityChecks: true, microbiologyResults: true, mrlResult: true } } },
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

  if (!spec || !brixRange) {
    return eligiblePallets.slice(0, quantity);
  }

  const scored = eligiblePallets.map((pallet) => {
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

  return scored.slice(0, quantity).map((s) => s.pallet);
}
