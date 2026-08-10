import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { QuantitiesSection } from "./quantities-section";
import { PackingSection } from "./packing-section";
import { EfficiencySection } from "./efficiency-section";
import { TemperatureSection } from "./temperature-section";
import { DecapEfficiencySection } from "./decap-efficiency-section";
import { LabourSection } from "./labour-section";

export default async function DailyReportPage({
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

  const [
    factories,
    clients,
    quantityEntries,
    packingLines,
    downtimeEvents,
    efficiencyRows,
    temperatureLogs,
    decapLog,
    decapWeightInAgg,
    labourEntries,
  ] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.dailyQuantityEntry.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: { factory: true },
      orderBy: [{ factory: { code: "asc" } }, { createdAt: "asc" }],
    }),
    prisma.dailyPackingLine.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      include: { factory: true, client: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dailyDowntimeEvent.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      orderBy: { fromTime: "asc" },
    }),
    prisma.dailyLineEfficiency.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.dailyTemperatureLog.findMany({
      where: { recordedAt: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.decapDailyLog.findUnique({ where: { date: dayStart } }),
    prisma.harvestTicket.aggregate({
      where: { receivedDate: { gte: dayStart, lt: dayEnd } },
      _sum: { netWeightKg: true },
    }),
    prisma.dailyLabourEntry.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
    }),
  ]);

  const factoriesForForms = factories.map((f) => ({ id: f.id, name: f.name, code: f.code }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Daily Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Frozen Strawberry Production Report — quantities, packing, line efficiency, and temperature logs.
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

      <QuantitiesSection date={dateStr} factories={factoriesForForms} entries={quantityEntries} />

      <PackingSection date={dateStr} factories={factoriesForForms} clients={clients} lines={packingLines} />

      <DecapEfficiencySection
        date={dateStr}
        weightInKg={decapWeightInAgg._sum.netWeightKg ?? 0}
        weightOutKg={decapLog?.weightOutKg ?? null}
        calyxKg={decapLog?.calyxKg ?? null}
      />

      {factories.map((f) => (
        <EfficiencySection
          key={f.id}
          factoryId={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          date={dateStr}
          events={downtimeEvents.filter((e) => e.factoryId === f.id)}
          efficiencyByShift={{
            DAY: efficiencyRows.find((e) => e.factoryId === f.id && e.shiftType === "DAY") ?? null,
            NIGHT: efficiencyRows.find((e) => e.factoryId === f.id && e.shiftType === "NIGHT") ?? null,
          }}
        />
      ))}

      {factories.map((f) => (
        <LabourSection
          key={f.id}
          factoryId={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          date={dateStr}
          entries={labourEntries.filter((e) => e.factoryId === f.id)}
        />
      ))}

      {factories.map((f) => (
        <TemperatureSection
          key={f.id}
          factoryId={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          factoryCode={f.code}
          logs={temperatureLogs.filter((l) => l.factoryId === f.id)}
        />
      ))}

      {factories.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">No factories set up yet — add one in Setup first.</p>
        </Card>
      )}
    </div>
  );
}
