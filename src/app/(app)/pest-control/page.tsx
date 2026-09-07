import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addLightTrapAction, addRodentTrapAction } from "./actions";
import { LightTrapForm } from "./light-trap-form";
import { LightTrapCard } from "./light-trap-card";
import { RodentTrapForm } from "./rodent-trap-form";
import { RodentTrapCard } from "./rodent-trap-card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function PestControlPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; month?: string; year?: string }>;
}) {
  const now = new Date();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.pestControl;
  const { factoryId: factoryIdParam, month: monthParam, year: yearParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [lightTraps, rodentTraps] = factoryId
    ? await Promise.all([
        prisma.lightTrap.findMany({
          where: { factoryId },
          include: { checks: { where: { date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "asc" } } },
          orderBy: { trapNumber: "asc" },
        }),
        prisma.rodentTrap.findMany({
          where: { factoryId },
          include: { checks: { where: { date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "asc" } } },
          orderBy: { trapNumber: "asc" },
        }),
      ])
    : [[], []];

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

      <div>
        <h2 className="text-lg font-semibold text-slate-900">{dict.lightTrapsTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{dict.lightTrapsSubtitle}</p>
      </div>

      <Card className="no-print">
        <h3 className="text-sm font-semibold text-slate-900">{dict.registerLightTrapTitle}</h3>
        <LightTrapForm factoryId={factoryId} action={addLightTrapAction} />
      </Card>

      {lightTraps.map((trap) => (
        <LightTrapCard key={trap.id} trap={trap} checks={trap.checks} month={month} year={year} />
      ))}
      {lightTraps.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noLightTraps}</p>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900">{dict.rodentControlTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{dict.rodentControlSubtitle}</p>
      </div>

      <Card className="no-print">
        <h3 className="text-sm font-semibold text-slate-900">{dict.registerRodentTrapTitle}</h3>
        <RodentTrapForm factoryId={factoryId} action={addRodentTrapAction} />
      </Card>

      {rodentTraps.map((trap) => (
        <RodentTrapCard key={trap.id} trap={trap} checks={trap.checks} month={month} year={year} />
      ))}
      {rodentTraps.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noRodentTraps}</p>
        </Card>
      )}
    </div>
  );
}
