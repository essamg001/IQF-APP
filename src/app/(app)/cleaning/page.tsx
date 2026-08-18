import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";
import { CleaningShiftCard } from "./cleaning-shift-card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function CleaningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.cleaningMode;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-end gap-3">
          <form className="flex items-end gap-2">
            <FieldGroup label={fullDict.common.date}>
              <Input name="date" type="date" defaultValue={dateStr} />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {fullDict.common.go}
            </Button>
          </form>
          <LinkButton href="/cleaning/history" variant="secondary">
            {dict.viewHistory}
          </LinkButton>
        </div>
      </div>

      {factories.map((f) => {
        const factoryName = `${f.name}${f.code ? ` (${f.code})` : ""}`;
        const daySc = scores.filter((s) => s.factoryId === f.id && s.shiftType === "DAY");
        const nightSc = scores.filter((s) => s.factoryId === f.id && s.shiftType === "NIGHT");
        const dayRec = records.find((r) => r.factoryId === f.id && r.shiftType === "DAY") ?? null;
        const nightRec = records.find((r) => r.factoryId === f.id && r.shiftType === "NIGHT") ?? null;

        return (
          <Card key={f.id}>
            <h3 className="text-sm font-semibold text-slate-900">
              {factoryName} — {dict.cleaningSuffix}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
              <CleaningShiftCard
                factoryId={f.id}
                date={dateStr}
                shiftType="DAY"
                shiftLabel={dict.shift1Day}
                scores={daySc}
                record={dayRec}
                canScoreProduction={canScoreProduction}
                canScoreMaintenance={canScoreMaintenance}
                currentUserLabel={currentUserLabel}
                dict={dict}
              />
              <CleaningShiftCard
                factoryId={f.id}
                date={dateStr}
                shiftType="NIGHT"
                shiftLabel={dict.shift2Night}
                scores={nightSc}
                record={nightRec}
                canScoreProduction={canScoreProduction}
                canScoreMaintenance={canScoreMaintenance}
                currentUserLabel={currentUserLabel}
                dict={dict}
              />
            </div>
          </Card>
        );
      })}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noFactoriesYet}</p>
        </Card>
      )}
    </div>
  );
}
