"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type MetricDef = { key: string; label: string; suffix: string };

export type PeriodRow = {
  key: string;
  label: string;
  count: number;
  rejected: number;
  rejectionRate: number;
  brix: number | null;
  metrics: Record<string, number | null>;
};

export type Period = "SHIFT" | "DAILY" | "WEEKLY" | "MONTHLY";

const PERIOD_LABEL: Record<Period, string> = {
  SHIFT: "By Shift",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const BUCKET_COLUMN_LABEL: Record<Period, string> = {
  SHIFT: "Shift",
  DAILY: "Date",
  WEEKLY: "Week",
  MONTHLY: "Month",
};

export function QualityPeriodTable({
  title,
  description,
  dataByPeriod,
  metrics,
}: {
  title: string;
  description?: string;
  dataByPeriod: Record<Period, PeriodRow[]>;
  metrics: MetricDef[];
}) {
  const [period, setPeriod] = useState<Period>("SHIFT");
  const rows = dataByPeriod[period];

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}

      <div className="mt-3 flex gap-1 border-b border-slate-200">
        {(["SHIFT", "DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
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

      <Card className="overflow-x-auto rounded-tl-none p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">{BUCKET_COLUMN_LABEL[period]}</th>
              <th className="px-4 py-2 font-medium">Checks</th>
              <th className="px-4 py-2 font-medium">Rejected</th>
              {metrics.map((m) => (
                <th key={m.key} className="whitespace-nowrap px-4 py-2 font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">{row.label}</td>
                <td className="px-4 py-2">{row.count}</td>
                <td className="px-4 py-2">
                  <Badge color={row.rejectionRate > 10 ? "red" : row.rejectionRate > 0 ? "amber" : "green"}>
                    {row.rejected} ({row.rejectionRate.toFixed(0)}%)
                  </Badge>
                </td>
                {metrics.map((m) => {
                  const value = m.key === "brix" ? row.brix : row.metrics[m.key];
                  return (
                    <td key={m.key} className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {value != null ? `${value.toFixed(1)}${m.suffix}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + metrics.length} className="px-4 py-8 text-center text-slate-400">
                  No checks logged in this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
