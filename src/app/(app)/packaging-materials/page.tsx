import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { updatePackagingMaterialsDailyLogAction } from "./actions";
import { ItemRegisterSection } from "./item-register-section";
import { MaterialsSection } from "./materials-section";
import { getPackagingLowStockWarnings } from "@/lib/packagingMaterials";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

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

  // Most recent prior entry per material, scoped to this factory -- used to
  // suggest tomorrow's opening balance from yesterday's closing balance.
  // Code/unit/min-max are no longer carried this way: they live on the
  // PackagingMaterial record itself now.
  const priorItems = await prisma.packagingMaterialItem.findMany({
    where: { dailyLog: { factoryId, date: { lt: date } }, materialId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { materialId: true, openingBalance: true, quantityReceived: true, quantityUsed: true, quantityDamaged: true },
    take: 200,
  });
  const priorByMaterial = new Map<string, { closingBalance: number }>();
  for (const item of priorItems) {
    if (!item.materialId || priorByMaterial.has(item.materialId) || item.openingBalance == null) continue;
    priorByMaterial.set(item.materialId, {
      closingBalance:
        item.openingBalance + (item.quantityReceived ?? 0) - (item.quantityUsed ?? 0) - (item.quantityDamaged ?? 0),
    });
  }

  const materials = await prisma.packagingMaterial.findMany({
    where: { factoryId },
    orderBy: { name: "asc" },
  });

  const lowStockWarnings = await getPackagingLowStockWarnings(factoryId);

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
        <form action={updatePackagingMaterialsDailyLogAction} className="no-print mt-3 grid grid-cols-3 gap-3">
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

      {lowStockWarnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900">{dict.lowStockBannerTitle}</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            {lowStockWarnings.map((w) => (
              <li key={w.material.id}>
                <span className="font-medium">{w.material.name}</span>
                {" — "}
                {w.reason === "BELOW_MINIMUM"
                  ? dict.belowMinimumStock.replace("{balance}", String(w.closingBalance)).replace("{min}", String(w.material.minStockLevel))
                  : dict.daysOfStockLeft.replace("{days}", w.daysOfStockLeft!.toFixed(1))}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <MaterialsSection factoryId={factoryId} materials={materials} />
      </Card>

      <Card>
        <ItemRegisterSection
          dailyLogId={header.id}
          items={header.items}
          priorByMaterial={Object.fromEntries(priorByMaterial)}
          materials={materials}
        />
      </Card>
    </div>
  );
}
