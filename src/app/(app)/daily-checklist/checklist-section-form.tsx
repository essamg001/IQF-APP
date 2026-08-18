"use client";

import { useActionState } from "react";
import { updateDailyChecklistSectionScoresAction } from "./actions";
import { Button } from "@/components/ui/button";
import { dailyChecklistScoreColor } from "@/lib/dailyChecklist";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type Item = { key: string; text: string };
type Score = { itemKey: string; score: number };

export function ChecklistSectionForm({
  factoryId,
  date,
  shiftType,
  sectionKey,
  items,
  scores,
  canEdit,
  dict,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  sectionKey: string;
  items: Item[];
  scores: Score[];
  canEdit: boolean;
  dict: Dictionary["dailyChecklist"];
}) {
  const { common } = useTranslations();
  const boundAction = updateDailyChecklistSectionScoresAction.bind(null, factoryId, date, shiftType, sectionKey);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  const currentScore = (itemKey: string) => scores.find((s) => s.itemKey === itemKey)?.score ?? "";

  return (
    <form action={formAction}>
      <div className="divide-y divide-slate-50">
        {items.map((item) => {
          const score = scores.find((s) => s.itemKey === item.key)?.score ?? null;
          return (
            <div key={item.key} className="flex items-center gap-2 py-1 text-sm">
              <span className="flex-1 text-slate-800">{item.text}</span>
              {score != null && (
                <span className={`text-xs font-semibold ${dailyChecklistScoreColor(score)}`}>{score}</span>
              )}
              <input
                type="number"
                name={`score_${item.key}`}
                min="0"
                max="10"
                defaultValue={currentScore(item.key)}
                disabled={!canEdit}
                className="w-14 rounded-md border border-slate-300 px-1.5 py-0.5 text-center text-sm disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <Button type="submit" variant="secondary" className="text-xs" disabled={pending}>
            {pending ? common.saving : dict.saveSection}
          </Button>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      )}
    </form>
  );
}
