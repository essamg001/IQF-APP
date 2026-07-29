import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LogRejectWasteForm } from "./log-reject-waste-form";

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shift = await prisma.shiftLog.findUnique({
    where: { id },
    include: { factory: true, lots: true, waste: { orderBy: { date: "desc" } } },
  });
  if (!shift) notFound();

  const hours = (shift.endTime.getTime() - shift.startTime.getTime()) / 3_600_000;
  const totalRejectWasteKg = shift.waste.reduce((s, w) => s + w.quantity, 0) * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {shift.factory.name} — {format(shift.date, "dd MMM yyyy")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <Badge color={shift.shiftType === "DAY" ? "amber" : "blue"}>
            {shift.shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
          </Badge>{" "}
          {format(shift.startTime, "HH:mm")}–{format(shift.endTime, "HH:mm")} · {hours.toFixed(1)}h ·{" "}
          {shift.workerCount} workers · {shift.lots.length} lot{shift.lots.length === 1 ? "" : "s"} produced
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Rejected fruit composted (this shift)</p>
          <p className="text-lg font-semibold text-slate-900">{totalRejectWasteKg.toFixed(0)} kg</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Entries logged</p>
          <p className="text-lg font-semibold text-slate-900">{shift.waste.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Rejected Fruit — Composted (below Grade B)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Fruit pulled off the inspection belt through the shift is gathered and weighed once at the end, not
          per-check or per-pallet — log that end-of-shift weight here.
        </p>

        {shift.waste.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {shift.waste.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2">
                <span>{w.reason}</span>
                <span className="text-slate-500">
                  {(w.quantity * 1000).toFixed(0)} kg · {w.date.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <LogRejectWasteForm shiftId={shift.id} />
        </div>
      </Card>
    </div>
  );
}
