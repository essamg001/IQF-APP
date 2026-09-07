import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function ShiftsPage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.shifts;
  const shifts = await prisma.shiftLog.findMany({
    include: { factory: true, _count: { select: { lots: true } }, waste: { select: { quantity: true } } },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/shifts/new" className="no-print">
            {dict.logShift}
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colShift}</th>
              <th className="px-4 py-2 font-medium">{dict.colStart}</th>
              <th className="px-4 py-2 font-medium">{dict.colEnd}</th>
              <th className="px-4 py-2 font-medium">{dict.colHours}</th>
              <th className="px-4 py-2 font-medium">{dict.colWorkers}</th>
              <th className="px-4 py-2 font-medium">{dict.colLotsProduced}</th>
              <th className="px-4 py-2 font-medium">{dict.colRejectWaste}</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => {
              const hours = s.endTime ? (s.endTime.getTime() - s.startTime.getTime()) / 3_600_000 : null;
              const rejectWasteKg = s.waste.reduce((sum, w) => sum + w.quantity, 0) * 1000;
              return (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <a href={`/shifts/${s.id}`} className="text-emerald-700 hover:underline">
                      {formatDate(s.date, "dd MMM yyyy", locale)}
                    </a>
                  </td>
                  <td className="px-4 py-2">{s.factory.name}</td>
                  <td className="px-4 py-2">
                    <Badge color={s.shiftType === "DAY" ? "amber" : "blue"}>
                      {s.shiftType === "DAY" ? dict.shift1Day : dict.shift2Night}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{formatDate(s.startTime, "HH:mm", locale)}</td>
                  <td className="px-4 py-2">
                    {s.endTime ? (
                      formatDate(s.endTime, "HH:mm", locale)
                    ) : (
                      <span className="text-slate-400">{dict.inProgress}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">{hours != null ? hours.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2">
                    {s.workerCount ?? <span className="text-slate-400">{dict.seeDailyReport}</span>}
                  </td>
                  <td className="px-4 py-2">{s._count.lots}</td>
                  <td className="px-4 py-2">
                    {s.waste.length > 0 ? (
                      `${rejectWasteKg.toFixed(0)} ${fullDict.common.kg}`
                    ) : (
                      <a href={`/shifts/${s.id}`} className="text-xs text-slate-400 hover:text-emerald-700 hover:underline">
                        {dict.logLink}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {shifts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  {dict.noShiftsLoggedYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
