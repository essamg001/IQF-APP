import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { DEFAULT_LAUNDRY_PACKHOUSE } from "@/lib/laundry";
import { RegisterSection } from "./register-section";
import { WashCycleSection } from "./wash-cycle-section";
import { SignOffSection } from "./sign-off-section";

export default async function LaundryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const { date: dateParam } = await searchParams;
  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const dayStart = parseLocalDateOnly(dateStr) ?? new Date();
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const location = DEFAULT_LAUNDRY_PACKHOUSE;

  const [records, cycles, signOff, nameOptions, itemTypeOptions] = await Promise.all([
    prisma.laundryRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, packhouse: location },
      orderBy: { createdAt: "asc" },
    }),
    prisma.laundryWashCycle.findMany({
      where: { date: { gte: dayStart, lt: dayEnd }, location },
      orderBy: { createdAt: "asc" },
    }),
    prisma.laundryDailySignOff.findUnique({ where: { date_location: { date: dayStart, location } } }),
    prisma.laundryRecord.findMany({ select: { workerName: true }, distinct: ["workerName"], take: 500 }),
    prisma.laundryWashCycle.findMany({
      select: { itemType: true, agent: true, purpose: true },
      distinct: ["itemType"],
      take: 500,
    }),
  ]);

  const knownNames = [...new Set(nameOptions.map((r) => r.workerName))].sort();
  const knownItemTypes = [...new Set(itemTypeOptions.map((r) => r.itemType))].sort();
  const knownAgents = [...new Set(itemTypeOptions.map((r) => r.agent).filter((v): v is string => !!v))].sort();
  const knownPurposes = [...new Set(itemTypeOptions.map((r) => r.purpose).filter((v): v is string => !!v))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Laundry</h1>
          <p className="mt-1 text-sm text-slate-500">
            Uniform laundering for the shared washroom serving Packhouse 11 &amp; 13 — HSE03296 tracks which garment
            piece each worker was issued; HSE03293 logs each wash cycle&apos;s parameters and the day&apos;s
            cleanliness sign-off.
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
