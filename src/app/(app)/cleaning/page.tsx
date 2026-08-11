import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";
import { CleaningShiftCard } from "./cleaning-shift-card";

export default async function CleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { date: dateParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [factories, scores, records] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.cleaningAreaScore.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
    prisma.cleaningShiftRecord.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
  ]);

  const canScoreProduction = canSignAsHeadOfProduction(session.user);
  const canScoreMaintenance = canSignAsHeadOfMaintenance(session.user);
  const currentUserLabel = session.user.name ?? session.user.email ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cleaning Mode</h1>
          <p className="mt-1 text-sm text-slate-500">
            Between-shift cleaning and drying — a 0-10 score per area from both Head of Production and Head of
            Maintenance, and a dual sign-off before the next shift starts.{" "}
            <Link href="/cleaning/history" className="text-emerald-700 hover:underline">
              View History
            </Link>
          </p>
        </div>
        <form className="flex items-end gap-2">
          <FieldGroup label="Date">
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Go
          </Button>
        </form>
      </div>

      {factories.map((f) => {
        const factoryName = `${f.name}${f.code ? ` (${f.code})` : ""}`;
        const daySc = scores.filter((s) => s.factoryId === f.id && s.shiftType === "DAY");
        const nightSc = scores.filter((s) => s.factoryId === f.id && s.shiftType === "NIGHT");
        const dayRec = records.find((r) => r.factoryId === f.id && r.shiftType === "DAY") ?? null;
        const nightRec = records.find((r) => r.factoryId === f.id && r.shiftType === "NIGHT") ?? null;

        return (
          <Card key={f.id}>
            <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Cleaning</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <CleaningShiftCard
                factoryId={f.id}
                date={dateStr}
                shiftType="DAY"
                shiftLabel="Shift 1 (Day)"
                scores={daySc}
                record={dayRec}
                canScoreProduction={canScoreProduction}
                canScoreMaintenance={canScoreMaintenance}
                currentUserLabel={currentUserLabel}
              />
              <CleaningShiftCard
                factoryId={f.id}
                date={dateStr}
                shiftType="NIGHT"
                shiftLabel="Shift 2 (Night)"
                scores={nightSc}
                record={nightRec}
                canScoreProduction={canScoreProduction}
                canScoreMaintenance={canScoreMaintenance}
                currentUserLabel={currentUserLabel}
              />
            </div>
          </Card>
        );
      })}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">No factories set up yet.</p>
        </Card>
      )}
    </div>
  );
}
