import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FORMAT_LABEL } from "@/lib/format";
import type { Grade, Format } from "@prisma/client";
import { bothLabsApprovedFilter, notBothLabsApprovedFilter } from "@/lib/microbiology";
import { isMrlCleared } from "@/lib/mrl";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";

const GRADES: Grade[] = ["A", "B"];
const FORMATS: Format[] = ["WHOLE", "SLICED", "DICED"];

export default async function AvailableToSellPage() {
  const [readyPallets, pendingMicroPallets, pendingOrders] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: "IN_STORAGE",
        lot: { shift: { is: { onHold: false } }, ...bothLabsApprovedFilter },
      },
      select: { weightTonnes: true, lot: { select: { grade: true, format: true, mrlResult: true } } },
    }),
    prisma.pallet.findMany({
      where: {
        status: "IN_STORAGE",
        lot: { OR: [{ shift: { is: { onHold: true } } }, notBothLabsApprovedFilter] },
      },
      select: { weightTonnes: true, lot: { select: { grade: true, format: true } } },
    }),
    prisma.order.findMany({
      where: { stage: { in: ["CONFIRMED", "IN_PRODUCTION", "PACKED"] } },
      select: { grade: true, format: true, quantityPallets: true, _count: { select: { pallets: true } } },
    }),
  ]);

  const rows = GRADES.flatMap((grade) =>
    FORMATS.map((format) => {
      const ready = readyPallets.filter(
        (p) => p.lot.grade === grade && p.lot.format === format && isMrlCleared(p.lot.mrlResult)
      );
      const pendingMicro = pendingMicroPallets.filter((p) => p.lot.grade === grade && p.lot.format === format);
      const committed = pendingOrders
        .filter((o) => o.grade === grade && o.format === format)
        .reduce((s, o) => s + Math.max(0, o.quantityPallets - o._count.pallets), 0);

      const readyPalletCount = ready.length;
      const readyTonnes = ready.reduce((s, p) => s + p.weightTonnes, 0);
      const availablePallets = readyPalletCount - committed;
      const availableTonnes = availablePallets * FULL_PALLET_WEIGHT_TONNES;

      return {
        grade,
        format,
        readyPalletCount,
        readyTonnes,
        committed,
        availablePallets,
        availableTonnes,
        pendingMicroCount: pendingMicro.length,
        pendingMicroTonnes: pendingMicro.reduce((s, p) => s + p.weightTonnes, 0),
      };
    })
  ).filter((r) => r.readyPalletCount > 0 || r.committed > 0 || r.pendingMicroCount > 0);

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Available to Sell</h1>
        <p className="mt-1 text-sm text-slate-500">
          What can be promised to a client right now — approved stock in storage, minus what&apos;s already committed
          to pending orders.
        </p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Grade / Format</th>
              <th className="px-4 py-2 font-medium">Ready to Sell</th>
              <th className="px-4 py-2 font-medium">Committed to Pending Orders</th>
              <th className="px-4 py-2 font-medium">Available to Sell</th>
              <th className="px-4 py-2 font-medium">Pending Microbiology</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.grade}-${r.format}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Badge color={r.grade === "A" ? "green" : "amber"}>Grade {r.grade}</Badge>{" "}
                  <span className="text-slate-700">{FORMAT_LABEL[r.format]}</span>
                </td>
                <td className="px-4 py-2">
                  {r.readyPalletCount} pallets <span className="text-slate-400">({r.readyTonnes.toFixed(1)}t)</span>
                </td>
                <td className="px-4 py-2">{r.committed} pallets</td>
                <td className="px-4 py-2">
                  {r.availablePallets < 0 ? (
                    <Badge color="red">
                      Short by {Math.abs(r.availablePallets)} pallets ({Math.abs(r.availableTonnes).toFixed(1)}t)
                    </Badge>
                  ) : r.availablePallets === 0 ? (
                    <Badge color="slate">Fully committed</Badge>
                  ) : (
                    <Badge color="green">
                      {r.availablePallets} pallets ({r.availableTonnes.toFixed(1)}t)
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {r.pendingMicroCount > 0 ? `${r.pendingMicroCount} pallets (${r.pendingMicroTonnes.toFixed(1)}t)` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No stock or pending orders to show yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        &quot;Ready to sell&quot; counts pallets currently in storage whose lot has passed microbiology approval.
        &quot;Committed&quot; is the remaining unallocated quantity on orders that are Confirmed, In Production, or
        Packed. &quot;Pending microbiology&quot; is stock physically in storage but not yet cleared to sell.
      </p>
    </div>
  );
}
