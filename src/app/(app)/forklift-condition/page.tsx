import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addForkliftEquipmentAction } from "./actions";
import { EquipmentForm } from "./equipment-form";
import { EquipmentCard } from "./equipment-card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function ForkliftConditionPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; month?: string; year?: string }>;
}) {
  const now = new Date();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.forkliftCondition;
  const EQUIPMENT_TYPE_LABEL = {
    DIESEL_CLARK: dict.typeDiesel,
    ELECTRIC_CLARK: dict.typeElectric,
    POWER_PALLET: dict.typePowerPallet,
  } as const;
  const { factoryId: factoryIdParam, month: monthParam, year: yearParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const equipment = factoryId
    ? await prisma.forkliftEquipment.findMany({
        where: { factoryId },
        include: { checks: { where: { date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "asc" } } },
        orderBy: { equipmentNumber: "asc" },
      })
    : [];

  const MONTH_LABELS = fullDict.common.months;

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
          <FieldGroup label={fullDict.common.month}>
            <Select name="month" defaultValue={String(month)}>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={fullDict.common.year}>
            <Input name="year" type="number" defaultValue={year} className="w-24" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.go}
          </Button>
        </form>
      </Card>

      <Card className="no-print">
        <h2 className="text-sm font-semibold text-slate-900">{dict.registerEquipmentTitle}</h2>
        <EquipmentForm factoryId={factoryId} action={addForkliftEquipmentAction} />
      </Card>

      {equipment.map((eq) => (
        <EquipmentCard
          key={eq.id}
          equipment={eq}
          checks={eq.checks}
          month={month}
          year={year}
          typeLabel={EQUIPMENT_TYPE_LABEL[eq.equipmentType]}
        />
      ))}
      {equipment.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noEquipment}</p>
        </Card>
      )}
    </div>
  );
}
