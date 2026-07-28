"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type Period = "DAILY" | "WEEKLY" | "MONTHLY";

export type FieldPeriodRow = {
  fieldId: string;
  fieldName: string;
  count: number;
  rejected: number;
  brix: number | null;
  fruitColorPct: number | null;
  internalQualityPct: number | null;
  cratesOkPct: number | null;
  overmaturePct: number | null;
  diameterUnder22mmPct: number | null;
  botrytisPct: number | null;
  pestDiseasePct: number | null;
  wormEatenPct: number | null;
  bruisesPct: number | null;
  shapeDeformitiesPct: number | null;
  sandDustPct: number | null;
  foreignBodiesPct: number | null;
};

const PERIOD_LABEL: Record<Period, string> = {
  DAILY: "Daily (Today)",
  WEEKLY: "Weekly (Last 7 Days)",
  MONTHLY: "Monthly (Last 30 Days)",
};

const METRICS: { key: keyof FieldPeriodRow; label: string; suffix: string }[] = [
  { key: "brix", label: "Brix (≥7)", suffix: "" },
  { key: "fruitColorPct", label: "Berry Colour (≥85%)", suffix: "%" },
  { key: "internalQualityPct", label: "Internal Quality (≤10%)", suffix: "%" },
  { key: "cratesOkPct", label: "Crates OK", suffix: "%" },
  { key: "overmaturePct", label: "Over Maturity (≤50%)", suffix: "%" },
  { key: "diameterUnder22mmPct", label: "Diameter <22mm (≤10%)", suffix: "%" },
  { key: "botrytisPct", label: "Botrytis (≤10%)", suffix: "%" },
  { key: "pestDiseasePct", label: "Pest/Disease (≤10%)", suffix: "%" },
  { key: "wormEatenPct", label: "Worm-Eaten (≤10%)", suffix: "%" },
  { key: "bruisesPct", label: "Bruises (≤20%)", suffix: "%" },
  { key: "shapeDeformitiesPct", label: "Mishape (≤50%)", suffix: "%" },
  { key: "sandDustPct", label: "Sand (≤15%)", suffix: "%" },
  { key: "foreignBodiesPct", label: "Foreign Bodies (0%)", suffix: "%" },
];

export function FieldQualityTable({ dataByPeriod }: { dataByPeriod: Record<Period, FieldPeriodRow[]> }) {
  const [period, setPeriod] = useState<Period>("WEEKLY");
  const rows = dataByPeriod[period];

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200">
        {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((p) => (
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
              <th className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Checks</th>
              <th className="px-4 py-2 font-medium">Rejected</th>
              {METRICS.map((m) => (
                <th key={m.key} className="whitespace-nowrap px-4 py-2 font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rejectionRate = (row.rejected / row.count) * 100;
              return (
                <tr key={row.fieldId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">{row.fieldName}</td>
                  <td className="px-4 py-2">{row.count}</td>
                  <td className="px-4 py-2">
                    <Badge color={rejectionRate > 10 ? "red" : rejectionRate > 0 ? "amber" : "green"}>
                      {row.rejected} ({rejectionRate.toFixed(0)}%)
                    </Badge>
                  </td>
                  {METRICS.map((m) => {
                    const value = row[m.key] as number | null;
                    return (
                      <td key={m.key} className="whitespace-nowrap px-4 py-2 text-slate-700">
                        {value != null ? `${value.toFixed(1)}${m.suffix}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3 + METRICS.length} className="px-4 py-8 text-center text-slate-400">
                  No Pre-Decap Arrival checks logged against a field in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
