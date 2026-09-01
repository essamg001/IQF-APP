"use client";

import { Card } from "@/components/ui/card";
import { QuantityEntryForm } from "./quantity-entry-form";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { removeQuantityEntryAction } from "./actions";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  return (
    <Card className="overflow-x-auto">
      <h2 className="text-sm font-semibold text-slate-900">{dict.quantitiesTitle}</h2>
      <div className="mt-3">
        <QuantityEntryForm date={date} factories={factories} />
      </div>

      <table className="mt-4 w-full text-start text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">{dict.plant}</th>
            <th className="px-2 py-2 font-medium">{dict.shift}</th>
            <th className="px-2 py-2 font-medium">{fullDict.common.variety}</th>
            <th className="px-2 py-2 font-medium">{dict.colFirstBalance}</th>
            <th className="px-2 py-2 font-medium">{dict.colRawIncoming}</th>
            <th className="px-2 py-2 font-medium">{dict.colInletForOp}</th>
            <th className="px-2 py-2 font-medium">{dict.colEndBalance}</th>
            <th className="px-2 py-2 font-medium">{dict.col1stClass}</th>
            <th className="px-2 py-2 font-medium">{dict.col2ndClass}</th>
            <th className="px-2 py-2 font-medium">{dict.colRejectedPre}</th>
            <th className="px-2 py-2 font-medium">{dict.colRejectedPost}</th>
            <th className="px-2 py-2 font-medium">{dict.totalPacked}</th>
            <th className="px-2 py-2 font-medium">{dict.lost}</th>
            <th className="px-2 py-2 font-medium"></th>
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
              <td className="px-2 py-1.5">
                <form action={removeQuantityEntryAction.bind(null, e.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={dict.removeQuantityEntryConfirm}
                    className="text-red-600 hover:underline"
                  >
                    {fullDict.common.remove}
                  </ConfirmSubmitButton>
                </form>
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td colSpan={14} className="px-2 py-6 text-center text-slate-400">
                {dict.noEntriesYet}
              </td>
            </tr>
          )}
          {entries.length > 0 && (
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
              <td colSpan={3} className="px-2 py-2">
                {dict.totalDayLabel}
              </td>
              {grandTotal.map((v, i) => (
                <td key={TON_FIELDS[i]} className="px-2 py-2">
                  {v.toFixed(3)}
                </td>
              ))}
              <td></td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
