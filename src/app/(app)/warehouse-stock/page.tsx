import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { updateWarehouseStockLogAction } from "./actions";
import { ItemCatalogSection } from "./item-catalog-section";
import { StockLogSection } from "./stock-log-section";
import { getWarehouseStockLowStockWarnings } from "@/lib/warehouseStock";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function WarehouseStockPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.warehouseStock;
  const { date: dateParam } = await searchParams;

  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const date = parseLocalDateOnly(dateStr) ?? new Date();

  // Ensure the day's header exists (harmless no-op if it already does) so
  // item rows always have a logId to attach to.
  const log = await prisma.warehouseStockLog.upsert({
    where: { date },
    update: {},
    create: { date },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  // Most recent prior entry per item, used to suggest today's opening
  // balance from the last recorded closing balance.
  const priorItems = await prisma.warehouseStockLogItem.findMany({
    where: { log: { date: { lt: date } }, itemId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { itemId: true, openingBalance: true, quantityReceived: true, quantityUsed: true, quantityDamaged: true },
    take: 200,
  });
  const priorByItem = new Map<string, { closingBalance: number }>();
  for (const item of priorItems) {
    if (!item.itemId || priorByItem.has(item.itemId) || item.openingBalance == null) continue;
    priorByItem.set(item.itemId, {
      closingBalance: item.openingBalance + (item.quantityReceived ?? 0) - (item.quantityUsed ?? 0) - (item.quantityDamaged ?? 0),
    });
  }

  const catalog = await prisma.warehouseStockItem.findMany({ orderBy: { name: "asc" } });
  const lowStockWarnings = await getWarehouseStockLowStockWarnings();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-3">
          <FieldGroup label={fullDict.common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.go}
          </Button>
        </form>
      </Card>

      <Card className="no-print">
        <h2 className="text-sm font-semibold text-slate-900">{dict.logHeaderTitle}</h2>
        <form action={updateWarehouseStockLogAction} className="mt-3 grid grid-cols-2 gap-3">
          <input type="hidden" name="date" value={dateStr} />
          <FieldGroup label={dict.storeSupervisorLabel}>
            <Input name="storeSupervisorName" defaultValue={log.storeSupervisorName ?? ""} />
          </FieldGroup>
          <div>
            <Button type="submit" variant="secondary">
              {fullDict.common.save}
            </Button>
          </div>
        </form>
      </Card>

      {lowStockWarnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900">{dict.lowStockBannerTitle}</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {lowStockWarnings.map((w) => (
              <li key={w.item.id}>
                <span className="font-medium">{w.item.name}</span>
                {" — "}
                {dict.belowMinimumStock.replace("{balance}", String(w.closingBalance)).replace("{min}", String(w.item.minStockLevel))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <ItemCatalogSection items={catalog} />
      </Card>

      <Card>
        <StockLogSection logId={log.id} items={log.items} priorByItem={Object.fromEntries(priorByItem)} catalog={catalog} />
      </Card>
    </div>
  );
}
