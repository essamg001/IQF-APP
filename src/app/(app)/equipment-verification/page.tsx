import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { MetalDetectorSection } from "./metal-detector-section";
import { ChlorineDosingSection } from "./chlorine-dosing-section";
import { updateChlorineSetPointAction } from "./actions";
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
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();

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
              <form action={updateChlorineSetPointAction.bind(null, f.id)} className="flex items-end gap-2">
                <FieldGroup label={dict.chlorineSetPointLabel}>
                  <Input
                    name="chlorineSetPointPpm"
                    type="number"
                    step="0.01"
                    defaultValue={f.chlorineSetPointPpm ?? ""}
                    className="w-24 px-1.5 py-1 text-xs"
                  />
                </FieldGroup>
                <Button type="submit" variant="secondary" className="px-2 py-1 text-xs">
                  {fullDict.common.save}
                </Button>
              </form>
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
