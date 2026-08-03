import { Card } from "@/components/ui/card";
import { QuantityEntryForm } from "./quantity-entry-form";

type QuantityEntry = {
  id: string;
  factory: { id: string; name: string; code: string | null };
  shiftType: string;
  variety: string;
  firstBalanceTon: number | null;
  rawIncomingTon: number | null;
  rawIncomingPct: number | null;
  inletForOperationTon: number | null;
  inletForOperationPct: number | null;
  endBalanceTon: number | null;
  endBalancePct: number | null;
  firstClassWholeTon: number | null;
  firstClassWholePct: number | null;
  secondClassWholeTon: number | null;
  secondClassWholePct: number | null;
  rejectedBeforeTunnelTon: number | null;
  rejectedBeforeTunnelPct: number | null;
  rejectedAfterTunnelTon: number | null;
  rejectedAfterTunnelPct: number | null;
  totalPackedTon: number | null;
  totalPackedPct: number | null;
  lostTon: number | null;
  lostPct: number | null;
};

const TON_FIELDS = [
  "firstBalanceTon",
  "rawIncomingTon",
  "inletForOperationTon",
  "endBalanceTon",
  "firstClassWholeTon",
  "secondClassWholeTon",
  "rejectedBeforeTunnelTon",
  "rejectedAfterTunnelTon",
  "totalPackedTon",
  "lostTon",
] as const;

function sumTon(entries: QuantityEntry[], field: (typeof TON_FIELDS)[number]) {
  return entries.reduce((s, e) => s + (e[field] ?? 0), 0);
}

function fmt(n: number | null) {
  return n != null ? n.toFixed(3) : "—";
}

export function QuantitiesSection({
  date,
  factories,
  entries,
}: {
  date: string;
  factories: { id: string; name: string; code: string | null }[];
  entries: QuantityEntry[];
}) {
  const grandTotal = TON_FIELDS.map((f) => sumTon(entries, f));

  return (
    <Card className="overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-900">I) Quantities</h2>
      <div className="mt-3">
        <QuantityEntryForm date={date} factories={factories} />
      </div>

      <table className="mt-4 w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">Plant</th>
            <th className="px-2 py-2 font-medium">Shift</th>
            <th className="px-2 py-2 font-medium">Variety</th>
            <th className="px-2 py-2 font-medium">First Balance</th>
            <th className="px-2 py-2 font-medium">Raw Incoming</th>
            <th className="px-2 py-2 font-medium">Inlet for Op.</th>
            <th className="px-2 py-2 font-medium">End Balance</th>
            <th className="px-2 py-2 font-medium">1st Class</th>
            <th className="px-2 py-2 font-medium">2nd Class</th>
            <th className="px-2 py-2 font-medium">Rejected (pre)</th>
            <th className="px-2 py-2 font-medium">Rejected (post)</th>
            <th className="px-2 py-2 font-medium">Total Packed</th>
            <th className="px-2 py-2 font-medium">Lost</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-800">
                {e.factory.name} {e.factory.code ? `(${e.factory.code})` : ""}
              </td>
              <td className="px-2 py-1.5">{e.shiftType === "DAY" ? "1" : "2"}</td>
              <td className="px-2 py-1.5">{e.variety}</td>
              <td className="px-2 py-1.5">{fmt(e.firstBalanceTon)}</td>
              <td className="px-2 py-1.5">
                {fmt(e.rawIncomingTon)} {e.rawIncomingPct != null && <span className="text-slate-400">({e.rawIncomingPct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.inletForOperationTon)}{" "}
                {e.inletForOperationPct != null && <span className="text-slate-400">({e.inletForOperationPct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.endBalanceTon)} {e.endBalancePct != null && <span className="text-slate-400">({e.endBalancePct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.firstClassWholeTon)}{" "}
                {e.firstClassWholePct != null && <span className="text-slate-400">({e.firstClassWholePct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.secondClassWholeTon)}{" "}
                {e.secondClassWholePct != null && <span className="text-slate-400">({e.secondClassWholePct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.rejectedBeforeTunnelTon)}{" "}
                {e.rejectedBeforeTunnelPct != null && <span className="text-slate-400">({e.rejectedBeforeTunnelPct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.rejectedAfterTunnelTon)}{" "}
                {e.rejectedAfterTunnelPct != null && <span className="text-slate-400">({e.rejectedAfterTunnelPct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.totalPackedTon)} {e.totalPackedPct != null && <span className="text-slate-400">({e.totalPackedPct}%)</span>}
              </td>
              <td className="px-2 py-1.5">
                {fmt(e.lostTon)} {e.lostPct != null && <span className="text-slate-400">({e.lostPct}%)</span>}
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={13} className="px-2 py-6 text-center text-slate-400">
                Nothing logged for this date yet.
              </td>
            </tr>
          )}
          {entries.length > 0 && (
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
              <td colSpan={3} className="px-2 py-2">
                Total day
              </td>
              {grandTotal.map((v, i) => (
                <td key={TON_FIELDS[i]} className="px-2 py-2">
                  {v.toFixed(3)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
