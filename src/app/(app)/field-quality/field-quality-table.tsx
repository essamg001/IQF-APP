"use client";

import { Fragment, useState } from "react";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type TicketCheck = {
  id: string;
  createdAt: Date;
  decision: string | null;
  brix: number;
  fruitColorPct: number | null;
  internalQualityPct: number | null;
  cleaningGoodCratesOk: boolean | null;
  overmaturePct: number | null;
  diameterUnder22mmPct: number | null;
  botrytisPct: number | null;
  pestDiseasePct: number | null;
  wormEatenPct: number | null;
  bruisesPct: number | null;
  shapeDeformitiesPct: number | null;
  sandDustPct: number | null;
  foreignBodiesPct: number | null;
  ticket: {
    serialNumber: string | null;
    harvestDate: Date | null;
    stationNo: string | null;
    plotValveGhNo: string | null;
    cutNo: string | null;
    weightKg: number | null;
    cratesCount: number | null;
  } | null;
};

export type FieldRow = {
  key: string; // fieldId
  label: string; // field name
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
  checks: TicketCheck[];
};

export type PeriodSection = { key: string; label: string; rows: FieldRow[] };

export type Period = "DAILY" | "WEEKLY" | "MONTHLY" | "SEASON";

const PERIOD_LABEL: Record<Period, string> = { DAILY: "Daily", WEEKLY: "Weekly", MONTHLY: "Monthly", SEASON: "Season" };

const METRICS: { key: keyof FieldRow; label: string; suffix: string }[] = [
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

// Same metrics as above minus cratesOkPct -- that's an aggregate-only concept
// (% of checks with crates OK) that doesn't apply to a single check; see the
// dedicated "Crates OK" column in the drill-down instead.
const CHECK_METRICS: { key: keyof TicketCheck; label: string; suffix: string }[] = [
  { key: "brix", label: "Brix (≥7)", suffix: "" },
  { key: "fruitColorPct", label: "Berry Colour (≥85%)", suffix: "%" },
  { key: "internalQualityPct", label: "Internal Quality (≤10%)", suffix: "%" },
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

const TOTAL_COLS = 4 + METRICS.length; // Field, Checks, Rejected, Trend + metrics
const DRILLDOWN_COLS = 8 + CHECK_METRICS.length; // Date, Ticket#, Harvest Date, Station/Plot, Cut#, Weight/Crates, Decision, Crates OK + metrics

function TrendBadge({ row }: { row: FieldRow }) {
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

function FieldRowCells({ row }: { row: FieldRow }) {
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

function CheckDrilldown({ checks }: { checks: TicketCheck[] }) {
  return (
    <tr className="bg-slate-50/60">
      <td colSpan={TOTAL_COLS} className="px-4 py-3">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Date/Time</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Ticket #</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Harvest Date</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Station/Plot</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Cut #</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Weight/Crates</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Decision</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Crates OK</th>
              {CHECK_METRICS.map((m) => (
                <th key={m.key} className="whitespace-nowrap px-2 py-1 font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-t border-slate-200">
                <td className="whitespace-nowrap px-2 py-1 text-slate-600">{format(c.createdAt, "dd MMM yyyy, HH:mm")}</td>
                {c.ticket ? (
                  <>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">{c.ticket.serialNumber ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                      {c.ticket.harvestDate ? format(c.ticket.harvestDate, "dd MMM yyyy") : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                      {[c.ticket.stationNo, c.ticket.plotValveGhNo].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">{c.ticket.cutNo ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                      {c.ticket.weightKg != null ? `${c.ticket.weightKg} kg` : "—"}
                      {c.ticket.cratesCount != null ? ` / ${c.ticket.cratesCount} crates` : ""}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="whitespace-nowrap px-2 py-1 italic text-slate-400">
                    No harvest ticket linked — logged directly against field
                  </td>
                )}
                <td className="whitespace-nowrap px-2 py-1">
                  {c.decision === "REJECTED" ? (
                    <Badge color="red">Rejected</Badge>
                  ) : c.decision === "ACCEPTED" ? (
                    <Badge color="green">Accepted</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                  {c.cleaningGoodCratesOk == null ? "—" : c.cleaningGoodCratesOk ? "OK" : "Not OK"}
                </td>
                {CHECK_METRICS.map((m) => {
                  const value = c[m.key] as number | null;
                  return (
                    <td key={m.key} className="whitespace-nowrap px-2 py-1 text-slate-700">
                      {value != null ? `${value.toFixed(1)}${m.suffix}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {checks.length === 0 && (
              <tr>
                <td colSpan={DRILLDOWN_COLS} className="px-2 py-3 text-center text-slate-400">
                  No inspections in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

function SectionTable({ section }: { section: PeriodSection }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (fieldKey: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-slate-500">{section.label}</p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-4 py-2 font-medium">Field</th>
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
            {section.rows.map((row) => (
              <Fragment key={row.key}>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">
                    <button type="button" onClick={() => toggle(row.key)} className="flex items-center gap-1.5 hover:underline">
                      <span className="text-slate-400">{expanded.has(row.key) ? "▾" : "▸"}</span>
                      {row.label}
                      <span className="text-xs font-normal text-slate-400">({row.checks.length} checks)</span>
                    </button>
                  </td>
                  <FieldRowCells row={row} />
                </tr>
                {expanded.has(row.key) && <CheckDrilldown checks={row.checks} />}
              </Fragment>
            ))}
            {section.rows.length === 0 && (
              <tr>
                <td colSpan={TOTAL_COLS} className="px-4 py-8 text-center text-slate-400">
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

export function FieldQualityTable({ dataByPeriod }: { dataByPeriod: Record<Period, PeriodSection[]> }) {
  const [period, setPeriod] = useState<Period>("DAILY");
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
          <p className="py-8 text-center text-sm text-slate-400">No Pre-Decap Arrival checks logged yet.</p>
        )}
      </div>
    </div>
  );
}
