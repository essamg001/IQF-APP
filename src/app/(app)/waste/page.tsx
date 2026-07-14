import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function WastePage() {
  const waste = await prisma.waste.findMany({
    include: { pallet: { include: { lot: true } } },
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
      <h1 className="text-xl font-semibold text-slate-900">Waste</h1>
      <p className="mt-1 text-sm text-slate-500">Track waste to identify trends and avoid recurrence.</p>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Total waste (tonnes)</p>
          <p className="text-lg font-semibold text-slate-900">{totalTonnes.toFixed(1)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-slate-500">Waste events</p>
          <p className="text-lg font-semibold text-slate-900">{waste.length}</p>
        </Card>
      </div>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Pallet</th>
              <th className="px-4 py-2 font-medium">Lot</th>
              <th className="px-4 py-2 font-medium">Quantity (t)</th>
              <th className="px-4 py-2 font-medium">Reason</th>
            </tr>
          </thead>
          <tbody>
            {waste.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">{w.date.toDateString()}</td>
                <td className="px-4 py-2">
                  <Link href={`/storage/${w.palletId}`} className="text-emerald-700 hover:underline">
                    {w.pallet.palletNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{w.pallet.lot.lotNumber}</td>
                <td className="px-4 py-2">{w.quantity}</td>
                <td className="px-4 py-2">{w.reason}</td>
              </tr>
            ))}
            {waste.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No waste recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
