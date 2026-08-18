import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { updatePackagingMaterialsDailyLogAction } from "./actions";
import { ItemRegisterSection } from "./item-register-section";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function PackagingMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; date?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.packagingMaterials;
  const { factoryId: factoryIdParam, date: dateParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const date = parseLocalDateOnly(dateStr) ?? new Date();

  if (!factoryId) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="text-sm text-slate-500">{dict.addFactoryFirst}</p>
      </div>
    );
  }

  // Ensure the day's header exists (harmless no-op if it already does) so
  // item rows always have a dailyLogId to attach to -- same "create on first
  // use" shape as the header upsert action itself.
  const header = await prisma.packagingMaterialsDailyLog.upsert({
    where: { factoryId_date: { factoryId, date } },
    update: {},
    create: { factoryId, date },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  // Most recent prior entry per item name (case-insensitive), scoped to this
  // factory -- used to suggest tomorrow's opening balance (from yesterday's
  // closing balance) and to carry forward the mostly-static stock-card
  // fields (code/unit/min/max) without retyping them every day.
  const priorItems = await prisma.packagingMaterialItem.findMany({
    where: { dailyLog: { factoryId, date: { lt: date } } },
    orderBy: { createdAt: "desc" },
    select: {
      itemName: true,
      openingBalance: true,
      quantityReceived: true,
      quantityUsed: true,
      quantityDamaged: true,
      productCode: true,
      productUnit: true,
      minLevel: true,
      maxLevel: true,
    },
    take: 200,
  });
  const priorByItem = new Map<
    string,
    { closingBalance: number; productCode: string | null; productUnit: string | null; minLevel: number | null; maxLevel: number | null }
  >();
  for (const item of priorItems) {
    const key = item.itemName.trim().toLowerCase();
    if (priorByItem.has(key) || item.openingBalance == null) continue;
    priorByItem.set(key, {
      closingBalance:
        item.openingBalance + (item.quantityReceived ?? 0) - (item.quantityUsed ?? 0) - (item.quantityDamaged ?? 0),
      productCode: item.productCode,
      productUnit: item.productUnit,
      minLevel: item.minLevel,
      maxLevel: item.maxLevel,
    });
  }

  const knownNames = await prisma.packagingMaterialItem.findMany({
    where: { dailyLog: { factoryId } },
    select: { itemName: true },
    distinct: ["itemName"],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <FieldGroup label={fullDict.common.factory}>
            <Select name="factoryId" defaultValue={factoryId}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={fullDict.common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.go}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.dayHeaderTitle}</h2>
        <form action={updatePackagingMaterialsDailyLogAction} className="mt-3 grid grid-cols-3 gap-3">
          <input type="hidden" name="factoryId" value={factoryId} />
          <input type="hidden" name="date" value={dateStr} />
          <FieldGroup label={dict.finalProductLabel}>
            <Input name="finalProduct" defaultValue={header.finalProduct ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.storeNameLabel}>
            <Input name="storeName" defaultValue={header.storeName ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.packhouseManagerLabel}>
            <Input name="packhouseManagerName" defaultValue={header.packhouseManagerName ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.storeSupervisorLabel}>
            <Input name="storeSupervisorName" defaultValue={header.storeSupervisorName ?? ""} />
          </FieldGroup>
          <div>
            <Button type="submit" variant="secondary">
              {fullDict.common.save}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <ItemRegisterSection
          dailyLogId={header.id}
          items={header.items}
          priorByItem={Object.fromEntries(priorByItem)}
          knownNames={knownNames.map((n) => n.itemName)}
        />
      </Card>
    </div>
  );
}
