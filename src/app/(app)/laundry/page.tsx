import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { DEFAULT_LAUNDRY_PACKHOUSE } from "@/lib/laundry";
import { RegisterSection } from "./register-section";
import { WashCycleSection } from "./wash-cycle-section";
import { SignOffSection } from "./sign-off-section";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function LaundryPage({ searchParams }: { searchParams: Promise<{ date?: string; location?: string }> }) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.laundry;

  const { date: dateParam, location: locationParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const location = locationParam ?? DEFAULT_LAUNDRY_PACKHOUSE;

  const [records, cycles, signOff, nameOptions, itemTypeOptions, agentOptions, factories] = await Promise.all([
    prisma.laundryRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, packhouse: location },
      orderBy: { createdAt: "asc" },
    }),
    prisma.laundryWashCycle.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, location },
      orderBy: { createdAt: "asc" },
      include: { agents: true },
    }),
    prisma.laundryDailySignOff.findUnique({ where: { date_location: { date: dayStart, location } } }),
    prisma.laundryRecord.findMany({ select: { workerName: true }, distinct: ["workerName"], take: 500 }),
    prisma.laundryWashCycle.findMany({
      select: { itemType: true, purpose: true },
      distinct: ["itemType"],
      take: 500,
    }),
    prisma.laundryWashCycleAgent.findMany({ select: { agentName: true }, distinct: ["agentName"], take: 500 }),
    prisma.factory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const knownNames = [...new Set(nameOptions.map((r) => r.workerName))].sort();
  const knownItemTypes = [...new Set(itemTypeOptions.map((r) => r.itemType))].sort();
  const knownAgents = [...new Set(agentOptions.map((r) => r.agentName))].sort();
  const knownPurposes = [...new Set(itemTypeOptions.map((r) => r.purpose).filter((v): v is string => !!v))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-end gap-2">
          <form className="no-print flex items-end gap-2">
            <FieldGroup label={dict.factoryLabel}>
              <Select name="location" defaultValue={location}>
                <option value={DEFAULT_LAUNDRY_PACKHOUSE}>{dict.bothFactoriesOption}</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label={fullDict.common.date}>
              <Input name="date" type="date" defaultValue={dateStr} />
            </FieldGroup>
            <Button type="submit" variant="secondary">
              {fullDict.common.go}
            </Button>
          </form>
          <PrintButton />
        </div>
      </div>

      <Card>
        <RegisterSection date={dateStr} packhouse={location} records={records} knownNames={knownNames} />
      </Card>

      <Card>
        <WashCycleSection
          date={dateStr}
          location={location}
          cycles={cycles}
          knownItemTypes={knownItemTypes}
          knownAgents={knownAgents}
          knownPurposes={knownPurposes}
        />
        <SignOffSection date={dateStr} location={location} signOff={signOff} />
      </Card>
    </div>
  );
}
