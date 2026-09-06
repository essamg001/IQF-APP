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
      orderBy: [{ dailyLog: { date: "desc" } }, { createdAt: "desc" }],
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

/**
 * Auto-deducts packaging stock the moment a pallet is packed (called from
 * final-product-entry/actions.ts, once per pallet, on first packing only --
 * not on later edits to the same pallet). For each material in this
 * factory's catalog that has quantityPerCarton and/or quantityPerPallet
 * set, appends one PackagingMaterialItem row continuing the running
 * balance from whatever the material's most recent row left off (same
 * chain the manual "add item" form's rows already form -- multiple rows
 * per material per day is the existing, expected shape, not new here).
 * Materials with neither field set are untouched, so this is opt-in per
 * item -- a material added without these ratios just never auto-deducts.
 */
export async function recordPackagingConsumptionForPallet(factoryId: string, date: Date, totalCartons: number): Promise<void> {
  const materials = await prisma.packagingMaterial.findMany({
    where: { factoryId, OR: [{ quantityPerCarton: { not: null } }, { quantityPerPallet: { not: null } }] },
  });
  if (materials.length === 0) return;

  const dailyLog = await prisma.packagingMaterialsDailyLog.upsert({
    where: { factoryId_date: { factoryId, date } },
    update: {},
    create: { factoryId, date },
  });

  for (const material of materials) {
    const consumed = (material.quantityPerCarton ?? 0) * totalCartons + (material.quantityPerPallet ?? 0);
    if (consumed <= 0) continue;

    const latest = await prisma.packagingMaterialItem.findFirst({
      where: { materialId: material.id },
      orderBy: [{ dailyLog: { date: "desc" } }, { createdAt: "desc" }],
      select: { openingBalance: true, quantityReceived: true, quantityUsed: true, quantityDamaged: true },
    });
    const priorClosing = latest
      ? closingBalance(latest.openingBalance, latest.quantityReceived, latest.quantityUsed, latest.quantityDamaged)
      : null;

    await prisma.packagingMaterialItem.create({
      data: {
        dailyLogId: dailyLog.id,
        materialId: material.id,
        itemName: material.name,
        productCode: material.code,
        productUnit: material.unit,
        openingBalance: priorClosing,
        quantityUsed: Math.round(consumed),
        supplyOrIssueDestination: "Auto-deducted: pallet packing",
      },
    });
  }
}
