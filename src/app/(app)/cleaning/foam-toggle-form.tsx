"use client";

import { toggleCleaningFoamAction } from "./actions";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

export function FoamToggleForm({
  factoryId,
  date,
  shiftType,
  cleanedWithFoam,
  disabled,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  cleanedWithFoam: boolean;
  disabled: boolean;
}) {
  const dict = useTranslations().cleaningMode;
  return (
    <form action={toggleCleaningFoamAction.bind(null, factoryId, date, shiftType)}>
      <button
        type="submit"
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
          cleanedWithFoam
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
        )}
      >
        <span>{cleanedWithFoam ? "☑" : "☐"}</span>
        {dict.cleanedWithFoam}
      </button>
    </form>
  );
}
