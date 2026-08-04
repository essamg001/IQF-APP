import { prisma } from "@/lib/prisma";
import type { Grade, Format } from "@prisma/client";
import { bothLabsApprovedFilter } from "@/lib/microbiology";
import { combinedCfuValue, exceedsClientLimit } from "@/lib/cfuTier";

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
    include: { lot: { include: { qualityChecks: true, microbiologyResults: true } } },
    orderBy: { createdAt: "asc" },
  });

  // A pallet can be lab-Approved (both labs signed off) and still carry a
  // cfu/g reading too high for this specific client's spec -- exclude those
  // up front so they never get suggested for an order they'd be rejected
  // against (see src/lib/cfuTier.ts). A pallet with no cfu reading yet isn't
  // excluded -- absence of data isn't evidence it exceeds the limit.
  const eligiblePallets = allEligiblePallets.filter((p) => {
    const cfuValue = combinedCfuValue(p.lot.microbiologyResults);
    return cfuValue == null || !exceedsClientLimit(cfuValue, spec?.maxCfuPerGram);
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
