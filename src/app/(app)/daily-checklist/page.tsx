import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction } from "@/lib/roles";
import { ChecklistFactoryCard } from "./checklist-factory-card";

export default async function DailyChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shiftType?: string }>;
}) {
  const session = await auth();
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
          <h1 className="text-xl font-semibold text-slate-900">Daily Checklist</h1>
          <p className="mt-1 text-sm text-slate-500">
            The Head of Production&apos;s per-shift plant walkthrough — a 0-10 score per item across arrivals,
            pre-cooling, production, packaging, cold stores, loading, warehouse, and services areas.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <FieldGroup label="Date">
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <FieldGroup label="Shift">
            <Select name="shiftType" defaultValue={shiftType}>
              <option value="DAY">Shift 1 (Day)</option>
              <option value="NIGHT">Shift 2 (Night)</option>
            </Select>
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Go
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
        />
      ))}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">No factories set up yet.</p>
        </Card>
      )}
    </div>
  );
}
