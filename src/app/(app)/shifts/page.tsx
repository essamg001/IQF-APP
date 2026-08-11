import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function ShiftsPage() {
  const shifts = await prisma.shiftLog.findMany({
    include: { factory: true, _count: { select: { lots: true } }, waste: { select: { quantity: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Hours Worked</h1>
          <p className="mt-1 text-sm text-slate-500">Shift logs per factory: timing, worker counts, and linked production.</p>
        </div>
        <LinkButton href="/shifts/new">Log Shift</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Factory</th>
              <th className="px-4 py-2 font-medium">Shift</th>
              <th className="px-4 py-2 font-medium">Start</th>
              <th className="px-4 py-2 font-medium">End</th>
              <th className="px-4 py-2 font-medium">Hours</th>
              <th className="px-4 py-2 font-medium">Workers</th>
              <th className="px-4 py-2 font-medium">Lots Produced</th>
              <th className="px-4 py-2 font-medium">Reject Waste</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => {
              const hours = (s.endTime.getTime() - s.startTime.getTime()) / 3_600_000;
              const rejectWasteKg = s.waste.reduce((sum, w) => sum + w.quantity, 0) * 1000;
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <a href={`/shifts/${s.id}`} className="text-emerald-700 hover:underline">
                      {format(s.date, "dd MMM yyyy")}
                    </a>
                  </td>
                  <td className="px-4 py-2">{s.factory.name}</td>
                  <td className="px-4 py-2">
                    <Badge color={s.shiftType === "DAY" ? "amber" : "blue"}>
                      {s.shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{format(s.startTime, "HH:mm")}</td>
                  <td className="px-4 py-2">{format(s.endTime, "HH:mm")}</td>
                  <td className="px-4 py-2">{hours.toFixed(1)}</td>
                  <td className="px-4 py-2">{s.workerCount}</td>
                  <td className="px-4 py-2">{s._count.lots}</td>
                  <td className="px-4 py-2">
                    {s.waste.length > 0 ? (
                      `${rejectWasteKg.toFixed(0)} kg`
                    ) : (
                      <a href={`/shifts/${s.id}`} className="text-xs text-slate-400 hover:text-emerald-700 hover:underline">
                        Log
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No shifts logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
