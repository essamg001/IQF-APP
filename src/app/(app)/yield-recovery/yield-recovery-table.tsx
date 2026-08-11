"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type FieldYieldRow = {
  key: string; // fieldId
  label: string; // field name
  rawKg: number;
  rawLineCount: number;
  finishedKg: number;
  palletCount: number;
  recoveryPct: number | null;
  prevRecoveryPct?: number | null;
};

export type PeriodSection = {
  key: string;
  label: string;
  rows: FieldYieldRow[];
  overallRawKg: number;
  overallFinishedKg: number;
  overallRecoveryPct: number | null;
};

export type Period = "DAILY" | "WEEKLY" | "MONTHLY" | "SEASON";

const PERIOD_LABEL: Record<Period, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", SEASON: "Season" };

function recoveryColor(pct: number | null): "slate" | "green" | "amber" | "red" {
  if (pct == null) return "slate";
  if (pct >= 80) return "green";
  if (pct >= 65) return "amber";
  return "red";
}

function formatKg(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(2)} t` : `${kg.toFixed(0)} kg`;
}

function TrendBadge({ row }: { row: FieldYieldRow }) {
  if (row.recoveryPct == null || row.prevRecoveryPct == null) return <span className="text-xs text-slate-400">no prior data</span>;
  const delta = row.recoveryPct - row.prevRecoveryPct;
  if (Math.abs(delta) < 1) return <span className="text-xs text-slate-400">flat</span>;
  const improving = delta > 0;
  return (
    <span className={cn("text-xs font-medium", improving ? "text-emerald-600" : "text-red-600")}>
      {improving ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts vs prior period
    </span>
  );
}

function SectionTable({ section }: { section: PeriodSection }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-3">
        <p className="text-xs font-semibold text-slate-500">{section.label}</p>
        {section.overallRecoveryPct != null && (
          <span className="text-xs text-slate-500">
            Overall:{" "}
            <Badge color={recoveryColor(section.overallRecoveryPct)}>{section.overallRecoveryPct.toFixed(1)}%</Badge>{" "}
            ({formatKg(section.overallFinishedKg)} finished / {formatKg(section.overallRawKg)} raw)
          </span>
        )}
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Raw In</th>
              <th className="px-4 py-2 font-medium">Finished Out</th>
              <th className="px-4 py-2 font-medium">Recovery</th>
              <th className="px-4 py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{row.label}</td>
                <td className="px-4 py-2 text-slate-700">
                  {formatKg(row.rawKg)}
                  <span className="ml-1 text-xs font-normal text-slate-400">({row.rawLineCount} lines)</span>
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {formatKg(row.finishedKg)}
                  <span className="ml-1 text-xs font-normal text-slate-400">({row.palletCount} pallets)</span>
                </td>
                <td className="px-4 py-2">
                  {row.recoveryPct != null ? (
                    <Badge color={recoveryColor(row.recoveryPct)}>{row.recoveryPct.toFixed(1)}%</Badge>
                  ) : (
                    <span className="text-xs text-slate-400">no raw weight logged</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <TrendBadge row={row} />
                </td>
              </tr>
            ))}
            {section.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No raw weight or finished pallets logged against a field in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export function YieldRecoveryTable({ dataByPeriod }: { dataByPeriod: Record<Period, PeriodSection[]> }) {
  const [period, setPeriod] = useState<Period>("WEEKLY");
  const sections = dataByPeriod[period];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200">
        {(["DAILY", "WEEKLY", "MONTHLY", "SEASON"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-t-md px-4 py-2 text-sm font-medium",
              period === p ? "bg-white text-emerald-700 border border-b-0 border-slate-200" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-tl-none border border-t-0 border-slate-200 bg-slate-50/40 p-4">
        {sections.map((s) => (
          <SectionTable key={s.key} section={s} />
        ))}
        {sections.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No raw weight or finished pallets logged yet.</p>
        )}
      </div>
    </div>
  );
}
