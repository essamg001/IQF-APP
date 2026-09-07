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

// Labor cost -- hours worked come from ShiftLog.startTime/endTime (owner
// confirmed 2026-09-07: employees don't leave mid-shift, so the shift's own
// duration IS the real hours-worked figure for everyone logged against it,
// not an assumption). Headcount comes from DailyLabourEntry, summed across
// every department/role for that same factory+date+shiftType -- the two
// models share exactly that key (ShiftLog's own @@unique constraint), so
// the join is exact, not fuzzy. A shift only contributes once it has a real
// endTime (most don't until Daily Report records line uptime -- see
// ShiftLog.endTime's own comment) and its factory has a wage rate on file;
// otherwise it's skipped, not assumed.
export async function getLaborCostUsd(): Promise<number> {
  const [shifts, labourEntries] = await Promise.all([
    prisma.shiftLog.findMany({
      where: { endTime: { not: null }, factory: { hourlyWageUsd: { not: null } } },
      select: { factoryId: true, date: true, shiftType: true, startTime: true, endTime: true, factory: { select: { hourlyWageUsd: true } } },
    }),
    prisma.dailyLabourEntry.findMany({
      select: { factoryId: true, date: true, shiftType: true, headcount: true },
    }),
  ]);

  const headcountByShift = new Map<string, number>();
  for (const entry of labourEntries) {
    if (entry.headcount == null) continue;
    const key = `${entry.factoryId}|${entry.date.getTime()}|${entry.shiftType}`;
    headcountByShift.set(key, (headcountByShift.get(key) ?? 0) + entry.headcount);
  }

  let total = 0;
  for (const shift of shifts) {
    const key = `${shift.factoryId}|${shift.date.getTime()}|${shift.shiftType}`;
    const headcount = headcountByShift.get(key);
    if (!headcount) continue;

    const hours = (shift.endTime!.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
    if (hours <= 0) continue;

    total += headcount * hours * shift.factory.hourlyWageUsd!;
  }
  return total;
}
