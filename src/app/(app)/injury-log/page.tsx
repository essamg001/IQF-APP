import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { updateMonthlyFirstAidSupplyLogAction } from "./actions";
import { InjuryRegisterSection } from "./injury-register-section";
import { runningBalances } from "@/lib/injuryLog";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function InjuryLogPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; month?: string; year?: string }>;
}) {
  const now = new Date();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.injuryLog;
  const MONTH_LABELS = fullDict.common.months;
  const { factoryId: factoryIdParam, month: monthParam, year: yearParam } = await searchParams;

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam ?? factories[0]?.id ?? "";
  const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
  const year = yearParam ? Number(yearParam) : now.getFullYear();

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [header, records, knownNames] = await Promise.all([
    factoryId
      ? prisma.monthlyFirstAidSupplyLog.findUnique({
          where: { factoryId_month_year: { factoryId, month, year } },
        })
      : null,
    factoryId
      ? prisma.injuryRecord.findMany({
          where: { factoryId, date: { gte: monthStart, lt: monthEnd } },
          orderBy: { date: "asc" },
        })
      : [],
    prisma.injuryRecord.findMany({ select: { employeeName: true }, distinct: ["employeeName"] }),
  ]);

  const bluePlasterBalances = runningBalances(
    header?.bluePlasterOpeningBalance ?? null,
    records.map((r) => r.bluePlasterItemsReleased)
  );
  const glovesBalances = runningBalances(
    header?.glovesOpeningBalance ?? null,
    records.map((r) => r.glovesItemsReleased)
  );

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

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.monthHeaderTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {dict.monthHeaderSubtitle.replace("{month}", MONTH_LABELS[month - 1]).replace("{year}", String(year))}
        </p>
        <form action={updateMonthlyFirstAidSupplyLogAction} className="no-print mt-3 grid grid-cols-3 gap-3">
          <input type="hidden" name="factoryId" value={factoryId} />
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="year" value={year} />
          <FieldGroup label={dict.supervisorLabel}>
            <Input name="supervisorName" defaultValue={header?.supervisorName ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.alternateSupervisorLabel}>
            <Input name="alternateSupervisorName" defaultValue={header?.alternateSupervisorName ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.bluePlasterLotLabel}>
            <Input name="bluePlasterLotNumber" defaultValue={header?.bluePlasterLotNumber ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.bluePlasterOpeningLabel}>
            <Input name="bluePlasterOpeningBalance" type="number" min="0" defaultValue={header?.bluePlasterOpeningBalance ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.glovesOpeningLabel}>
            <Input name="glovesOpeningBalance" type="number" min="0" defaultValue={header?.glovesOpeningBalance ?? ""} />
          </FieldGroup>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              {fullDict.common.save}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <InjuryRegisterSection
          factoryId={factoryId}
          records={records}
          bluePlasterBalances={bluePlasterBalances}
          glovesBalances={glovesBalances}
          knownNames={knownNames.map((n) => n.employeeName)}
        />
      </Card>
    </div>
  );
}
