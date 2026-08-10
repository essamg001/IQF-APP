"use client";

import { toggleDailyChecklistItemAction } from "./actions";
import { cn } from "@/lib/cn";

export function ChecklistItemToggle({
  factoryId,
  date,
  shiftType,
  itemKey,
  text,
  checked,
  confirmedByName,
  disabled,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  itemKey: string;
  text: string;
  checked: boolean;
  confirmedByName: string | null;
  disabled: boolean;
}) {
  return (
    <form action={toggleDailyChecklistItemAction.bind(null, factoryId, date, shiftType, itemKey)}>
      <label className={cn("flex items-start gap-2 py-1 text-sm", disabled ? "cursor-default" : "cursor-pointer")}>
        <input
          type="checkbox"
          defaultChecked={checked}
          disabled={disabled}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="mt-0.5"
        />
        <span className="flex-1">
          <span className={checked ? "text-slate-400 line-through" : "text-slate-800"}>{text}</span>
          {checked && confirmedByName && <span className="ml-2 text-xs text-slate-400">— {confirmedByName}</span>}
        </span>
      </label>
    </form>
  );
}
