import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function WastePage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.waste;

  const waste = await prisma.waste.findMany({
    include: { pallet: { include: { lot: true } }, shift: { include: { factory: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });

  const totalTonnes = waste.reduce((sum, w) => sum + w.quantity, 0);

  const byReason = new Map<string, number>();
  for (const w of waste) {
    byReason.set(w.reason, (byReason.get(w.reason) ?? 0) + w.quantity);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.totalWasteTonnes}</p>
          <p className="text-lg font-semibold text-slate-900">{totalTonnes.toFixed(1)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">{dict.wasteEvents}</p>
          <p className="text-lg font-semibold text-slate-900">{waste.length}</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colSource}</th>
              <th className="px-4 py-2 font-medium">{dict.colQuantity}</th>
              <th className="px-4 py-2 font-medium">{dict.colReason}</th>
            </tr>
          </thead>
          <tbody>
            {waste.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">{formatDate(w.date, "dd MMM yyyy", locale)}</td>
                <td className="px-4 py-2">
                  {w.pallet ? (
                    <>
                      <Link
                        href={`/storage/${w.palletId}`}
                        className={cn("text-emerald-700 hover:underline", w.pallet.isTestData && TEST_DATA_TEXT_CLASS)}
                      >
                        {w.pallet.palletNumber}
                      </Link>
                      <span className={cn("text-slate-500", w.pallet.lot.isTestData && TEST_DATA_TEXT_CLASS)}>
                        {" "}
                        · {dict.lotPrefix} {w.pallet.lot.lotNumber}
                      </span>
                      {(w.pallet.isTestData || w.pallet.lot.isTestData) && (
                        <>
                          {" "}
                          <TestDataBadge />
                        </>
                      )}
                    </>
                  ) : w.shift ? (
                    <Link href={`/shifts/${w.shiftId}`} className="text-emerald-700 hover:underline">
                      {w.shift.factory.name} · {formatDate(w.shift.date, "dd MMM yyyy", locale)} (
                      {w.shift.shiftType === "DAY" ? fullDict.lab.dayShift : fullDict.lab.nightShift})
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{w.quantity}</td>
                <td className="px-4 py-2">{w.reason}</td>
              </tr>
            ))}
            {waste.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {dict.noWaste}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
