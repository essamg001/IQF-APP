import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly, addDays, toDateOnlyString } from "@/lib/dates";
import { MetalDetectorSection } from "./metal-detector-section";
import { ChlorineDosingSection } from "./chlorine-dosing-section";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function EquipmentVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.equipmentVerification;

  const { date: dateParam } = await searchParams;
  const now = new Date();
  // The Night shift's early hours (0-6) are stored under the PREVIOUS
  // calendar day (see hourSlotDate in shiftHours.ts) -- so before 7 AM,
  // "today" would default this page to a Night shift that hasn't started
  // for another 12+ hours, hiding the one that's actually still in
  // progress. Defaulting to yesterday during that window shows the real
  // current shift without anyone having to know to pick the date manually.
  const defaultDateStr = now.getHours() < 7 ? toDateOnlyString(addDays(now, -1)) : toDateOnlyString(now);
  const dateStr = dateParam ?? defaultDateStr;
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [factories, metalChecks, maintenanceChecks, chlorineChecks] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.metalDetectorCheck.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.metalDetectorMaintenanceCheck.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
    prisma.chlorineDosingCheck.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  const currentUserLabel = session.user.name ?? session.user.email ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <form className="flex items-end gap-2">
          <FieldGroup label={fullDict.common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {fullDict.common.go}
          </Button>
        </form>
      </div>

      {factories.map((f) => {
        const factoryName = `${f.name}${f.code ? ` (${f.code})` : ""}`;
        return (
          <Card key={f.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{factoryName}</h3>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
              {(["DAY", "NIGHT"] as const).map((shiftType) => (
                <div key={shiftType} className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {shiftType === "DAY" ? dict.shift1Day : dict.shift2Night}
                  </h4>
                  <MetalDetectorSection
                    factoryId={f.id}
                    date={dateStr}
                    shiftType={shiftType}
                    checks={metalChecks.filter((c) => c.factoryId === f.id && c.shiftType === shiftType)}
                    maintenanceCheck={
                      maintenanceChecks.find((m) => m.factoryId === f.id && m.shiftType === shiftType) ?? null
                    }
                    currentUserLabel={currentUserLabel}
                    now={now}
                  />
                  <ChlorineDosingSection
                    factoryId={f.id}
                    date={dateStr}
                    shiftType={shiftType}
                    checks={chlorineChecks.filter((c) => c.factoryId === f.id && c.shiftType === shiftType)}
                    currentUserLabel={currentUserLabel}
                    now={now}
                    setPointPpm={f.chlorineSetPointPpm}
                  />
                </div>
              ))}
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
