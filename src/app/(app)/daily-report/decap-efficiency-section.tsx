import { Card } from "@/components/ui/card";
import { DecapEfficiencyForm } from "./decap-efficiency-form";

export function DecapEfficiencySection({
  date,
  weightInKg,
  weightOutKg,
  calyxKg,
}: {
  date: string;
  weightInKg: number;
  weightOutKg: number | null;
  calyxKg: number | null;
}) {
  const out = weightOutKg ?? 0;
  const calyx = calyxKg ?? 0;
  const lost = weightInKg > 0 ? weightInKg - out - calyx : 0;
  const hasData = weightInKg > 0 && (weightOutKg != null || calyxKg != null);

  const pct = (v: number) => (weightInKg > 0 ? Math.max(0, (v / weightInKg) * 100) : 0);
  const efficiencyPct = weightInKg > 0 && weightOutKg != null ? (out / weightInKg) * 100 : null;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">Decap Facility Efficiency</h2>
      <p className="mt-1 text-xs text-slate-500">
        Weight In is the day&apos;s total from Harvest Ticket receipts at decap (already captured there). Weight Out
        and Calyx are entered here once the day&apos;s totals are known — Lost fruit = Weight In − Weight Out − Calyx.
      </p>

      <div className="mt-3">
        <DecapEfficiencyForm date={date} weightOutKg={weightOutKg} calyxKg={calyxKg} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-500">Weight In</p>
          <p className="text-lg font-semibold text-slate-900">{weightInKg.toFixed(1)} kg</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Weight Out (packed)</p>
          <p className="text-lg font-semibold text-emerald-700">{weightOutKg != null ? `${out.toFixed(1)} kg` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Calyx</p>
          <p className="text-lg font-semibold text-slate-600">{calyxKg != null ? `${calyx.toFixed(1)} kg` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Lost</p>
          <p className={`text-lg font-semibold ${lost > 0 ? "text-red-600" : "text-slate-400"}`}>
            {hasData ? `${lost.toFixed(1)} kg` : "—"}
          </p>
        </div>
      </div>

      {hasData && (
        <div className="mt-4">
          <div className="flex h-6 w-full overflow-hidden rounded-md bg-slate-100">
            <div
              className="flex items-center justify-center bg-emerald-500 text-[10px] font-medium text-white"
              style={{ width: `${pct(out)}%` }}
              title={`Packed: ${out.toFixed(1)} kg (${pct(out).toFixed(0)}%)`}
            />
            <div className="w-0.5 bg-white" />
            <div
              className="flex items-center justify-center bg-slate-400 text-[10px] font-medium text-white"
              style={{ width: `${pct(calyx)}%` }}
              title={`Calyx: ${calyx.toFixed(1)} kg (${pct(calyx).toFixed(0)}%)`}
            />
            <div className="w-0.5 bg-white" />
            <div
              className="flex items-center justify-center bg-red-500 text-[10px] font-medium text-white"
              style={{ width: `${pct(lost)}%` }}
              title={`Lost: ${lost.toFixed(1)} kg (${pct(lost).toFixed(0)}%)`}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Packed {pct(out).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> Calyx {pct(calyx).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Lost {pct(lost).toFixed(0)}%
            </span>
            {efficiencyPct != null && (
              <span className="ml-auto font-medium text-slate-800">Efficiency: {efficiencyPct.toFixed(1)}%</span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
