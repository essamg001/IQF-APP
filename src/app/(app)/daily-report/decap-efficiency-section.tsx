"use client";

import { Card } from "@/components/ui/card";
import { DecapEfficiencyForm } from "./decap-efficiency-form";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  const out = weightOutKg ?? 0;
  const calyx = calyxKg ?? 0;
  const lost = weightInKg > 0 ? weightInKg - out - calyx : 0;
  const hasData = weightInKg > 0 && (weightOutKg != null || calyxKg != null);

  const pct = (v: number) => (weightInKg > 0 ? Math.max(0, (v / weightInKg) * 100) : 0);
  const efficiencyPct = weightInKg > 0 && weightOutKg != null ? (out / weightInKg) * 100 : null;

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">{dict.decapTitle}</h2>
      <p className="mt-1 text-xs text-slate-500">{dict.decapDescription}</p>

      <div className="mt-3">
        <DecapEfficiencyForm date={date} weightOutKg={weightOutKg} calyxKg={calyxKg} />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-500">{dict.weightInLabel}</p>
          <p className="text-lg font-semibold text-slate-900">{weightInKg.toFixed(1)} kg</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{dict.weightOutPackedLabel}</p>
          <p className="text-lg font-semibold text-emerald-700">{weightOutKg != null ? `${out.toFixed(1)} kg` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{dict.calyxLabel}</p>
          <p className="text-lg font-semibold text-slate-600">{calyxKg != null ? `${calyx.toFixed(1)} kg` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{dict.lost}</p>
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
              title={dict.packedTooltip.replace("{value}", out.toFixed(1)).replace("{pct}", pct(out).toFixed(0))}
            />
            <div className="w-0.5 bg-white" />
            <div
              className="flex items-center justify-center bg-slate-400 text-[10px] font-medium text-white"
              style={{ width: `${pct(calyx)}%` }}
              title={dict.calyxTooltip.replace("{value}", calyx.toFixed(1)).replace("{pct}", pct(calyx).toFixed(0))}
            />
            <div className="w-0.5 bg-white" />
            <div
              className="flex items-center justify-center bg-red-500 text-[10px] font-medium text-white"
              style={{ width: `${pct(lost)}%` }}
              title={dict.lostTooltip.replace("{value}", lost.toFixed(1)).replace("{pct}", pct(lost).toFixed(0))}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> {dict.packedLegend.replace("{pct}", pct(out).toFixed(0))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-400" /> {dict.calyxLegend.replace("{pct}", pct(calyx).toFixed(0))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> {dict.lostLegend.replace("{pct}", pct(lost).toFixed(0))}
            </span>
            {efficiencyPct != null && (
              <span className="ms-auto font-medium text-slate-800">
                {dict.efficiencyLabel.replace("{value}", efficiencyPct.toFixed(1))}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
