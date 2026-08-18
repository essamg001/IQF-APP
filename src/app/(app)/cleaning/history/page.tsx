import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { parseLocalDateOnly, toDateOnlyString } from "@/lib/dates";
import { FactoryHistorySection } from "./factory-history-section";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const DEFAULT_RANGE_DAYS = 30;

export default async function CleaningHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.cleaningHistory;

  const { from: fromParam, to: toParam } = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const fromStr = fromParam ?? toDateOnlyString(defaultFrom);
  const toStr = toParam ?? toDateOnlyString(today);
  const fromDate = parseLocalDateOnly(fromStr) ?? defaultFrom;
  const toDate = parseLocalDateOnly(toStr) ?? today;

  const [factories, scores, records] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.cleaningAreaScore.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { factoryId: true, date: true, shiftType: true, area: true, productionScore: true, maintenanceScore: true },
    }),
    prisma.cleaningShiftRecord.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: {
        factoryId: true,
        date: true,
        shiftType: true,
        cleanedWithFoam: true,
        productionSignedByName: true,
        productionSignedAt: true,
        maintenanceSignedByName: true,
        maintenanceSignedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-end gap-3">
          <form className="flex items-end gap-2">
            <FieldGroup label={dict.from}>
              <Input name="from" type="date" defaultValue={fromStr} />
            </FieldGroup>
            <FieldGroup label={dict.to}>
              <Input name="to" type="date" defaultValue={toStr} />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {fullDict.common.go}
            </Button>
          </form>
          <LinkButton href="/cleaning" variant="secondary">
            {dict.backToCleaningMode}
          </LinkButton>
        </div>
      </div>

      {factories.map((f) => (
        <FactoryHistorySection
          key={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          scores={scores.filter((s) => s.factoryId === f.id)}
          records={records.filter((r) => r.factoryId === f.id)}
          dict={dict}
          areaDict={fullDict.cleaningMode}
        />
      ))}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noFactoriesYet}</p>
        </Card>
      )}
    </div>
  );
}
