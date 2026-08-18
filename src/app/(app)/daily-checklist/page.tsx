import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction } from "@/lib/roles";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { ChecklistFactoryCard } from "./checklist-factory-card";

export default async function DailyChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shiftType?: string }>;
}) {
  const session = await auth();
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.dailyChecklist;
  const common = fullDict.common;
  const { date: dateParam, shiftType: shiftParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const shiftType = shiftParam === "NIGHT" ? "NIGHT" : "DAY";
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();

  const [factories, scores, supervisorEntries] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.dailyProductionChecklistScore.findMany({
      where: { date: dayStart, shiftType },
      select: { factoryId: true, itemKey: true, score: true },
    }),
    prisma.dailyLabourEntry.findMany({
      where: { date: dayStart, shiftType, role: "SUPERVISOR" },
      select: { factoryId: true, department: true, supervisorName: true },
    }),
  ]);

  const canEdit = canSignAsHeadOfProduction(session?.user);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <form className="flex items-end gap-2">
          <FieldGroup label={common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <FieldGroup label={fullDict.dailyReport.shift}>
            <Select name="shiftType" defaultValue={shiftType}>
              <option value="DAY">{dict.shift1Day}</option>
              <option value="NIGHT">{dict.shift2Night}</option>
            </Select>
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {common.go}
          </Button>
        </form>
      </div>

      {factories.map((f) => (
        <ChecklistFactoryCard
          key={f.id}
          factoryId={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          date={dateStr}
          shiftType={shiftType}
          scores={scores.filter((s) => s.factoryId === f.id)}
          supervisorsByDepartment={supervisorEntries.filter((e) => e.factoryId === f.id)}
          canEdit={canEdit}
          dict={dict}
        />
      ))}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noFactories}</p>
        </Card>
      )}
    </div>
  );
}
