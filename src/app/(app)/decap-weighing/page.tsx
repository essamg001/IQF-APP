import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { parseLocalDateOnly } from "@/lib/dates";
import { ShiftSection } from "./shift-section";
import { netDecapWeighingKg, getDecapWeighingTotalsForDate } from "@/lib/decapWeighing";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";
import type { ShiftType } from "@prisma/client";

const SHIFTS: ShiftType[] = ["DAY", "NIGHT"];

export default async function DecapWeighingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.decapWeighing;
  const common = fullDict.common;
  const { date: dateParam } = await searchParams;

  const dateStr = dateParam ?? new Date().toISOString().slice(0, 10);
  const date = parseLocalDateOnly(dateStr) ?? new Date();

  const shifts = await prisma.decapShift.findMany({
    where: { date, shiftType: { in: SHIFTS } },
    include: { weighings: { orderBy: { createdAt: "asc" } } },
  });
  const shiftByType = new Map(shifts.map((s) => [s.shiftType, s]));

  const totals = await getDecapWeighingTotalsForDate(date);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <Card className="no-print">
        <form className="flex flex-wrap items-end gap-3">
          <FieldGroup label={common.date}>
            <Input name="date" type="date" defaultValue={dateStr} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {common.go}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.dailyTotalsTitle}</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-slate-500">{dict.typeProductExit}</p>
            <p className="text-lg font-semibold text-emerald-700">
              {totals.productExitKg != null ? `${totals.productExitKg.toFixed(1)} kg` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{dict.typeCalyx}</p>
            <p className="text-lg font-semibold text-slate-600">
              {totals.calyxKg != null ? `${totals.calyxKg.toFixed(1)} kg` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{dict.typeRejected}</p>
            <p className="text-lg font-semibold text-amber-700">
              {totals.rejectedKg != null ? `${totals.rejectedKg.toFixed(1)} kg` : "—"}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">{dict.collectiveNote}</p>
      </Card>

      {SHIFTS.map((shiftType) => {
        const shift = shiftByType.get(shiftType);
        const weighings = shift?.weighings ?? [];
        const netWeights = Object.fromEntries(weighings.map((w) => [w.id, netDecapWeighingKg(w)]));
        return (
          <Card key={shiftType}>
            <ShiftSection
              date={dateStr}
              shiftType={shiftType}
              shiftLabel={shiftType === "DAY" ? dict.shiftDay : dict.shiftNight}
              weighings={weighings}
              netWeights={netWeights}
            />
          </Card>
        );
      })}
    </div>
  );
}
