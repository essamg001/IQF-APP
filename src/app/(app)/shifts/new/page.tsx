import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { ShiftForm } from "./shift-form";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ factoryId?: string; shiftType?: string; date?: string }>;
}) {
  const [factories, efficiencyRows] = await Promise.all([
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    // Daily Report already captures each shift's line uptime window -- reuse
    // it to prefill Log Shift's start/end time instead of making someone type
    // the same times twice. Kept as a separate, editable prefill (not a hard
    // link) since shift clock-in/out can legitimately differ from line uptime
    // (setup/changeover time).
    prisma.dailyLineEfficiency.findMany({
      where: { OR: [{ uptimeFrom: { not: null } }, { uptimeTo: { not: null } }] },
      select: { factoryId: true, date: true, shiftType: true, uptimeFrom: true, uptimeTo: true },
    }),
  ]);
  const { factoryId, shiftType, date } = await searchParams;

  const efficiencyLookup = efficiencyRows.map((r) => ({
    factoryId: r.factoryId,
    date: format(r.date, "yyyy-MM-dd"),
    shiftType: r.shiftType,
    uptimeFrom: r.uptimeFrom ? format(r.uptimeFrom, "HH:mm") : null,
    uptimeTo: r.uptimeTo ? format(r.uptimeTo, "HH:mm") : null,
  }));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Log Shift</h1>
      <div className="mt-6 max-w-lg">
        <ShiftForm factories={factories} initial={{ factoryId, shiftType, date }} efficiencyLookup={efficiencyLookup} />
      </div>
    </div>
  );
}
