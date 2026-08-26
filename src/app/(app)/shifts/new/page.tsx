import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ShiftForm } from "./shift-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; shiftType?: string; date?: string }>;
}) {
  const [factories, efficiencyRows, fieldShifts] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    // Daily Report already captures each shift's line uptime window -- reuse
    // it to prefill Log Shift's start time instead of making someone type it
    // twice. Kept as a separate, editable prefill (not a hard link) since
    // shift clock-in can legitimately differ from line uptime (setup time).
    // End time and worker count aren't asked for here at all -- see
    // shift-form.tsx and updateLineEfficiencyAction/
    // updateDepartmentLabourEntryAction in daily-report/actions.ts.
    prisma.dailyLineEfficiency.findMany({
      where: { OR: [{ uptimeFrom: { not: null } }, { uptimeTo: { not: null } }] },
      select: { factoryId: true, date: true, shiftType: true, uptimeFrom: true, uptimeTo: true },
    }),
    // Which fields already have an accepted Post-Decap check tied to this
    // date+shift -- read-only preview so opening a shift shows what's
    // already known to be feeding it, same lookup Log Production Lot uses.
    // Keyed by date+shiftType only (not factory): decap is one shared
    // facility, so the same fields supply both IQF1 and IQF2 for a shift.
    prisma.decapShift.findMany({
      where: { qualityChecks: { some: { checkpoint: "POST_DECAP", decision: "ACCEPTED", fieldId: { not: null } } } },
      select: {
        date: true,
        shiftType: true,
        qualityChecks: {
          where: { checkpoint: "POST_DECAP", decision: "ACCEPTED", fieldId: { not: null } },
          select: { field: { select: { name: true } } },
          distinct: ["fieldId"],
        },
      },
    }),
  ]);
  const { factoryId, shiftType, date } = await searchParams;
  const dict = getDictionary(await resolveLocale()).shifts;

  const efficiencyLookup = efficiencyRows.map((r) => ({
    factoryId: r.factoryId,
    date: format(r.date, "yyyy-MM-dd"),
    shiftType: r.shiftType,
    uptimeFrom: r.uptimeFrom ? format(r.uptimeFrom, "HH:mm") : null,
    uptimeTo: r.uptimeTo ? format(r.uptimeTo, "HH:mm") : null,
  }));

  const fieldsLookup = fieldShifts.map((s) => ({
    date: format(s.date, "yyyy-MM-dd"),
    shiftType: s.shiftType,
    fieldNames: [...new Set(s.qualityChecks.map((c) => c.field!.name))].sort(),
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.logShift}</h1>
      <div className="mt-6 max-w-lg">
        <ShiftForm
          factories={factories}
          initial={{ factoryId, shiftType, date }}
          efficiencyLookup={efficiencyLookup}
          fieldsLookup={fieldsLookup}
        />
      </div>
    </div>
  );
}
