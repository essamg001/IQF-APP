import { prisma } from "@/lib/prisma";
import type { DecapWeighing } from "@prisma/client";

/**
 * Net weight is derived, not stored -- same "closing balance" reasoning
 * used everywhere else in this app (packagingMaterials.ts, warehouseStock.ts).
 * Covers both weighing shapes with one formula: a two-stage weighing
 * (INTAKE/PRODUCT_EXIT) subtracts the second (empty) weight; a single-reading
 * weighing (CALYX/REJECTED) has no secondWeightKg, so that term is a no-op.
 * Either way, an empty-crates deduction comes off last if one was recorded.
 */
export function netDecapWeighingKg(w: Pick<DecapWeighing, "firstWeightKg" | "secondWeightKg" | "emptyCratesDeductionKg">): number | null {
  if (w.firstWeightKg == null) return null;
  const afterSecondStage = w.secondWeightKg != null ? w.firstWeightKg - w.secondWeightKg : w.firstWeightKg;
  return afterSecondStage - (w.emptyCratesDeductionKg ?? 0);
}

/**
 * Sums net weight by type across every weighing recorded for shifts on the
 * given date (all pack houses combined -- the "collective" total the owner
 * asked for, computed rather than separately entered, same as the earlier
 * per-pack-house design decision). Used by Daily Report's
 * DecapEfficiencySection to replace the old manual weightOutKg/calyxKg
 * entry once real weighing records exist for a date.
 */
export async function getDecapWeighingTotalsForDate(date: Date): Promise<{
  productExitKg: number | null;
  calyxKg: number | null;
  rejectedKg: number | null;
  weighingCount: number;
}> {
  const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  const weighings = await prisma.decapWeighing.findMany({
    where: { decapShift: { date: { gte: date, lt: nextDate } } },
    select: { weighingType: true, firstWeightKg: true, secondWeightKg: true, emptyCratesDeductionKg: true },
  });

  const sums = { INTAKE: 0, PRODUCT_EXIT: 0, CALYX: 0, REJECTED: 0 };
  const counted = { INTAKE: false, PRODUCT_EXIT: false, CALYX: false, REJECTED: false };
  for (const w of weighings) {
    const net = netDecapWeighingKg(w);
    if (net == null) continue;
    sums[w.weighingType] += net;
    counted[w.weighingType] = true;
  }

  return {
    productExitKg: counted.PRODUCT_EXIT ? sums.PRODUCT_EXIT : null,
    calyxKg: counted.CALYX ? sums.CALYX : null,
    rejectedKg: counted.REJECTED ? sums.REJECTED : null,
    weighingCount: weighings.length,
  };
}
