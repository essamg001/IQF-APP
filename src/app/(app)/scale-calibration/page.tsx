import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addWeighingScaleAction } from "./actions";
import { ScaleForm } from "./scale-form";
import { ScaleCard } from "./scale-card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function ScaleCalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; month?: string; year?: string }>;
}) {
  const now = new Date();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.scaleCalibration;
  const { factoryId: factoryIdParam, month: monthParam, year: yearParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const scales = factoryId
    ? await prisma.weighingScale.findMany({
        where: { factoryId },
        include: { checks: { where: { date: { gte: monthStart, lt: monthEnd } }, orderBy: { date: "asc" } } },
        orderBy: { scaleNumber: "asc" },
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
        <h2 className="text-sm font-semibold text-slate-900">{dict.registerScaleTitle}</h2>
        <ScaleForm factoryId={factoryId} action={addWeighingScaleAction} />
      </Card>

      {scales.map((s) => (
        <ScaleCard key={s.id} scale={s} checks={s.checks} month={month} year={year} />
      ))}
      {scales.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noScales}</p>
        </Card>
      )}
    </div>
  );
}
