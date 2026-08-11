import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { MetalDetectorSection } from "./metal-detector-section";
import { ChlorineDosingSection } from "./chlorine-dosing-section";

export default async function EquipmentVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const { date: dateParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
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
          <h1 className="text-xl font-semibold text-slate-900">Equipment Verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Metal Detector (CAL03607) — a sealed carton is passed through the packaging-room detector before
            palletisation, tested hourly against three metal test kits (Ferrous/Non-Ferrous/Stainless steel).
            Dosing Pump / Chlorine (STR03117) — the hourly manual free-chlorine reading in the wash tank checked
            against the dosing machine&apos;s set point.
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
        return (
          <Card key={f.id}>
            <h3 className="text-sm font-semibold text-slate-900">{factoryName}</h3>
            <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
              {(["DAY", "NIGHT"] as const).map((shiftType) => (
                <div key={shiftType} className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
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
                  />
                  <ChlorineDosingSection
                    factoryId={f.id}
                    date={dateStr}
                    shiftType={shiftType}
                    checks={chlorineChecks.filter((c) => c.factoryId === f.id && c.shiftType === shiftType)}
                    currentUserLabel={currentUserLabel}
                  />
                </div>
              ))}
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
