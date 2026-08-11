import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { FactoryHistorySection } from "./factory-history-section";

const DEFAULT_RANGE_DAYS = 30;

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CleaningHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { from: fromParam, to: toParam } = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const fromStr = fromParam ?? toDateInputValue(defaultFrom);
  const toStr = toParam ?? toDateInputValue(today);
  const fromDate = parseLocalDateOnly(fromStr) ?? defaultFrom;
  const toDate = parseLocalDateOnly(toStr) ?? today;

  const [factories, scores, records] = await Promise.all([
    prisma.factory.findMany({ orderBy: { code: "asc" } }),
    prisma.cleaningAreaScore.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { factoryId: true, date: true, shiftType: true, area: true, productionScore: true, maintenanceScore: true },
    }),
    prisma.cleaningShiftRecord.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: {
        factoryId: true,
        date: true,
        shiftType: true,
        cleanedWithFoam: true,
        productionSignedByName: true,
        productionSignedAt: true,
        maintenanceSignedByName: true,
        maintenanceSignedAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cleaning History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Day-by-day results, low-score flags, and score trends per area.{" "}
            <Link href="/cleaning" className="text-emerald-700 hover:underline">
              Back to Cleaning Mode
            </Link>
          </p>
        </div>
        <form className="flex items-end gap-2">
          <FieldGroup label="From">
            <Input name="from" type="date" defaultValue={fromStr} />
          </FieldGroup>
          <FieldGroup label="To">
            <Input name="to" type="date" defaultValue={toStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Go
          </Button>
        </form>
      </div>

      {factories.map((f) => (
        <FactoryHistorySection
          key={f.id}
          factoryName={`${f.name}${f.code ? ` (${f.code})` : ""}`}
          scores={scores.filter((s) => s.factoryId === f.id)}
          records={records.filter((r) => r.factoryId === f.id)}
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
