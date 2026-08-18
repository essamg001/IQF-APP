import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LogRejectWasteForm } from "./log-reject-waste-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

function shiftHoursWorked(shift: { startTime: Date; endTime: Date | null }): number | null {
  if (!shift.endTime) return null;
  return (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
}

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dict = getDictionary(await resolveLocale()).shifts;

  const shift = await prisma.shiftLog.findUnique({
    where: { id },
    include: { factory: true, lots: { include: { pallets: true } }, waste: { orderBy: { date: "desc" } } },
  });
  if (!shift) notFound();

  const hours = shiftHoursWorked(shift);
  const totalRejectWasteKg = shift.waste.reduce((s, w) => s + w.quantity, 0) * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {shift.factory.name} — {format(shift.date, "dd MMM yyyy")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <Badge color={shift.shiftType === "DAY" ? "amber" : "blue"}>
            {shift.shiftType === "DAY" ? dict.shift1Day : dict.shift2Night}
          </Badge>{" "}
          {format(shift.startTime, "HH:mm")}–{shift.endTime ? format(shift.endTime, "HH:mm") : dict.inProgress}
          {hours != null && ` · ${dict.hoursSuffix.replace("{hours}", hours.toFixed(1))}`}
          {shift.workerCount != null && ` · ${dict.workersSuffix.replace("{count}", String(shift.workerCount))}`} ·{" "}
          {shift.lots.length}{" "}
          {dict.lotsProducedSuffix.replace("{plural}", shift.lots.length === 1 ? "" : "s")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.rejectedFruitComposted}</p>
          <p className="text-lg font-semibold text-slate-900">{totalRejectWasteKg.toFixed(0)} kg</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.entriesLogged}</p>
          <p className="text-lg font-semibold text-slate-900">{shift.waste.length}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">{dict.rejectFruitTitle}</h2>
        <p className="mt-1 text-xs text-slate-500">{dict.rejectFruitSubtitle}</p>

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
