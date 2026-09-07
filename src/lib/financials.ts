import { prisma } from "@/lib/prisma";

// Real, already-committed purchasing spend -- REQUESTED/FORWARDED_TO_ACCOUNTING/
// APPROVED aren't money spent yet, only ORDERED (a PO is placed) and
// everything after it (RECEIVED, CONFIRMED_WORKING) represent actual spend.
const COMMITTED_PURCHASE_STATUSES = ["ORDERED", "RECEIVED", "CONFIRMED_WORKING"] as const;

export async function getPurchasingSpendUsd(): Promise<number> {
  const result = await prisma.purchaseRequest.aggregate({
    where: { status: { in: [...COMMITTED_PURCHASE_STATUSES] }, costUsd: { not: null } },
    _sum: { costUsd: true },
  });
  return result._sum?.costUsd ?? 0;
}

// Raw material cost -- only tickets with a real pricePerKgUsd on file
// contribute; most won't yet, since this is a newly-added skeleton field
// (see prisma/schema.prisma HarvestTicket.pricePerKgUsd).
export async function getRawMaterialCostUsd(): Promise<number> {
  const tickets = await prisma.harvestTicket.findMany({
    where: { pricePerKgUsd: { not: null }, netWeightKg: { not: null } },
    select: { netWeightKg: true, pricePerKgUsd: true },
  });
  return tickets.reduce((sum, t) => sum + t.netWeightKg! * t.pricePerKgUsd!, 0);
}

// Packaging cost -- quantityUsed on each logged item, times its material's
// costPerUnitUsd (skeleton field, see PackagingMaterial.costPerUnitUsd).
// Items with no linked material, or a material with no cost on file,
// contribute nothing (not zero-cost, just not yet priced).
export async function getPackagingCostUsd(): Promise<number> {
  const items = await prisma.packagingMaterialItem.findMany({
    where: { quantityUsed: { not: null }, material: { costPerUnitUsd: { not: null } } },
    select: { quantityUsed: true, material: { select: { costPerUnitUsd: true } } },
  });
  return items.reduce((sum, i) => sum + i.quantityUsed! * i.material!.costPerUnitUsd!, 0);
}

// Waste cost -- only events with a real costUsd on file (see Waste.costUsd)
// contribute. Most historical waste rows won't have one yet.
export async function getWasteCostUsd(): Promise<number> {
  const result = await prisma.waste.aggregate({
    where: { costUsd: { not: null } },
    _sum: { costUsd: true },
  });
  return result._sum?.costUsd ?? 0;
}

// Company-wide logistics cost, broken down by category -- same underlying
// ContainerCost rows the Financials page already totals per-container, just
// rolled up across every container instead.
export async function getLogisticsCostByCategory(): Promise<{ category: string; totalUsd: number }[]> {
  const grouped = await prisma.containerCost.groupBy({
    by: ["category"],
    _sum: { amountUsd: true },
    orderBy: { _sum: { amountUsd: "desc" } },
  });
  return grouped.map((g) => ({ category: g.category, totalUsd: g._sum.amountUsd ?? 0 }));
}
