import { prisma } from "@/lib/prisma";
import type { PackagingMaterial } from "@prisma/client";

// Closing balance is derived, not stored -- opening plus received minus
// used minus damaged. A typed balance can drift from reality; a computed
// one can't (same reasoning as isStructuralIssueOverdue / injuryLog.
// runningBalances).
export function closingBalance(
  opening: number | null,
  received: number | null,
  used: number | null,
  damaged: number | null
): number | null {
  if (opening == null) return null;
  return opening + (received ?? 0) - (used ?? 0) - (damaged ?? 0);
}

const LOW_STOCK_DAYS_THRESHOLD = 3;

export type PackagingLowStockWarning = {
  material: PackagingMaterial;
  closingBalance: number;
  daysOfStockLeft: number | null;
  reason: "BELOW_MINIMUM" | "PROJECTED_LOW";
};

// Shared by the Alerts scanner (src/lib/alerts.ts) and the inline banner on
// /packaging-materials, so the low-stock threshold math lives in exactly
// one place. Two independent triggers: a static floor (minStockLevel) and,
// where a consumption ratio is set, a projection from actual production
// output (DailyQuantityEntry.totalPackedTon) -- either can fire on its own.
export async function getPackagingLowStockWarnings(factoryId: string): Promise<PackagingLowStockWarning[]> {
  const materials = await prisma.packagingMaterial.findMany({ where: { factoryId } });
  if (materials.length === 0) return [];

  const latestQuantityEntry = await prisma.dailyQuantityEntry.findFirst({
    where: { factoryId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  let dailyPackedTon: number | null = null;
  if (latestQuantityEntry) {
    const entries = await prisma.dailyQuantityEntry.findMany({
      where: { factoryId, date: latestQuantityEntry.date },
      select: { totalPackedTon: true },
    });
    dailyPackedTon = entries.reduce((sum, e) => sum + (e.totalPackedTon ?? 0), 0);
  }

  const warnings: PackagingLowStockWarning[] = [];
  for (const material of materials) {
    const latestItem = await prisma.packagingMaterialItem.findFirst({
      where: { materialId: material.id },
      orderBy: { dailyLog: { date: "desc" } },
      select: { openingBalance: true, quantityReceived: true, quantityUsed: true, quantityDamaged: true },
    });
    if (!latestItem) continue;

    const balance = closingBalance(
      latestItem.openingBalance,
      latestItem.quantityReceived,
      latestItem.quantityUsed,
      latestItem.quantityDamaged
    );
    if (balance == null) continue;

    const belowMinimum = material.minStockLevel != null && balance <= material.minStockLevel;

    let daysOfStockLeft: number | null = null;
    let projectedLow = false;
    if (material.consumptionRatioPerTon != null && dailyPackedTon != null && dailyPackedTon > 0) {
      const expectedDailyUse = material.consumptionRatioPerTon * dailyPackedTon;
      if (expectedDailyUse > 0) {
        daysOfStockLeft = balance / expectedDailyUse;
        projectedLow = daysOfStockLeft < LOW_STOCK_DAYS_THRESHOLD;
      }
    }

    if (belowMinimum || projectedLow) {
      warnings.push({
        material,
        closingBalance: balance,
        daysOfStockLeft,
        reason: belowMinimum ? "BELOW_MINIMUM" : "PROJECTED_LOW",
      });
    }
  }
  return warnings;
}
