import { prisma } from "@/lib/prisma";
import { closingBalance } from "@/lib/packagingMaterials";
import type { WarehouseStockItem } from "@prisma/client";

export type WarehouseStockLowStockWarning = {
  item: WarehouseStockItem;
  closingBalance: number;
};

// Shared by the Alerts scanner (src/lib/alerts.ts) and the inline banner on
// /warehouse-stock. Simpler than getPackagingLowStockWarnings -- this stock
// isn't tied to production output, so there's no consumption-ratio
// projection, just a static floor.
export async function getWarehouseStockLowStockWarnings(): Promise<WarehouseStockLowStockWarning[]> {
  const items = await prisma.warehouseStockItem.findMany({ where: { minStockLevel: { not: null } } });
  if (items.length === 0) return [];

  const warnings: WarehouseStockLowStockWarning[] = [];
  for (const item of items) {
    const latest = await prisma.warehouseStockLogItem.findFirst({
      where: { itemId: item.id },
      orderBy: [{ log: { date: "desc" } }, { createdAt: "desc" }],
      select: { openingBalance: true, quantityReceived: true, quantityUsed: true, quantityDamaged: true },
    });
    if (!latest) continue;

    const balance = closingBalance(latest.openingBalance, latest.quantityReceived, latest.quantityUsed, latest.quantityDamaged);
    if (balance == null) continue;

    if (item.minStockLevel != null && balance <= item.minStockLevel) {
      warnings.push({ item, closingBalance: balance });
    }
  }
  return warnings;
}
