"use client";

import { Fragment, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type ScoreRow = {
  key: string;
  label: string;
  count: number;
  rejected: number;
  rejectionRate: number;
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
  prevRejectionRate?: number | null;
};

const METRICS: { key: keyof ScoreRow; label: string; suffix: string }[] = [
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

function TrendBadge({ row }: { row: ScoreRow }) {
  if (row.prevRejectionRate == null) return <span className="text-xs text-slate-400">no prior data</span>;
  const delta = row.rejectionRate - row.prevRejectionRate;
  if (Math.abs(delta) < 1) return <span className="text-xs text-slate-400">flat</span>;
  const worsening = delta > 0;
  return (
    <span className={cn("text-xs font-medium", worsening ? "text-red-600" : "text-emerald-600")}>
      {worsening ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts vs prior period
    </span>
  );
}

function ScoreRowCells({ row }: { row: ScoreRow }) {
  return (
    <>
      <td className="px-4 py-2">{row.count}</td>
      <td className="px-4 py-2">
        <Badge color={row.rejectionRate > 10 ? "red" : row.rejectionRate > 0 ? "amber" : "green"}>
          {row.rejected} ({row.rejectionRate.toFixed(0)}%)
        </Badge>
      </td>
      <td className="px-4 py-2">
        <TrendBadge row={row} />
      </td>
      {METRICS.map((m) => {
        const value = row[m.key] as number | null;
        return (
          <td key={m.key} className="whitespace-nowrap px-4 py-2 text-slate-700">
            {value != null ? `${value.toFixed(1)}${m.suffix}` : "—"}
          </td>
        );
      })}
    </>
  );
}

export function GrowerScorecardTable({
  farmRows,
  fieldRowsByFarm,
}: {
  farmRows: ScoreRow[];
  fieldRowsByFarm: Record<string, ScoreRow[]>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (farm: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(farm)) next.delete(farm);
      else next.add(farm);
      return next;
    });
  };

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">Grower / Farm</th>
            <th className="px-4 py-2 font-medium">Checks</th>
            <th className="px-4 py-2 font-medium">Rejected</th>
            <th className="px-4 py-2 font-medium">Trend</th>
            {METRICS.map((m) => (
              <th key={m.key} className="whitespace-nowrap px-4 py-2 font-medium">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {farmRows.map((row) => (
            <Fragment key={row.key}>
              <tr className="border-b border-slate-100 hover:bg-slate-50">
                <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">
                  <button type="button" onClick={() => toggle(row.key)} className="flex items-center gap-1.5 hover:underline">
                    <span className="text-slate-400">{expanded.has(row.key) ? "▾" : "▸"}</span>
                    {row.label}
                    <span className="text-xs font-normal text-slate-400">
                      ({fieldRowsByFarm[row.key]?.length ?? 0} plots)
                    </span>
                  </button>
                </td>
                <ScoreRowCells row={row} />
              </tr>
              {expanded.has(row.key) &&
                (fieldRowsByFarm[row.key] ?? []).map((fieldRow) => (
                  <tr key={fieldRow.key} className="border-b border-slate-100 bg-slate-50/60 last:border-0">
                    <td className="sticky left-0 bg-slate-50/60 py-2 pl-10 pr-4 text-slate-600">{fieldRow.label}</td>
                    <ScoreRowCells row={fieldRow} />
                  </tr>
                ))}
            </Fragment>
          ))}
          {farmRows.length === 0 && (
            <tr>
              <td colSpan={4 + METRICS.length} className="px-4 py-8 text-center text-slate-400">
                No Pre-Decap Arrival checks logged against a field in this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
