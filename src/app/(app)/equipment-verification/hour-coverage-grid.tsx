"use client";

import { cn } from "@/lib/cn";
import { formatHour } from "@/lib/shiftHours";

// Compact per-hour strip so a missed hourly check is obvious at a glance,
// instead of having to scan the detail table for gaps. Clicking a missing
// (red) hour pre-fills the entry form's Time field with that hour.
export function HourCoverageGrid({
  hours,
  hasCheck,
  elapsed,
  onPick,
}: {
  hours: number[];
  hasCheck: (hour: number) => boolean;
  elapsed: (hour: number) => boolean;
  onPick?: (hour: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {hours.map((h) => {
        const done = hasCheck(h);
        const late = !done && elapsed(h);
        return (
          <button
            key={h}
            type="button"
            onClick={() => onPick?.(h)}
            title={done ? `${formatHour(h)} — recorded` : late ? `${formatHour(h)} — missing` : `${formatHour(h)} — upcoming`}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold",
              done
                ? "bg-emerald-100 text-emerald-800"
                : late
                  ? "bg-red-100 text-red-700"
                  : "bg-slate-100 text-slate-400"
            )}
          >
            {formatHour(h).replace(":00 ", "")}
          </button>
        );
      })}
    </div>
  );
}
