"use client";

import { useActionState } from "react";
import { updateCleaningScoresAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CLEANING_AREAS, CLEANING_AREA_LABEL } from "@/lib/cleaning";

type Score = { area: string; productionScore: number | null; maintenanceScore: number | null };

export function ScoreEntryForm({
  factoryId,
  date,
  shiftType,
  role,
  scores,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  role: "PRODUCTION" | "MAINTENANCE";
  scores: Score[];
}) {
  const boundAction = updateCleaningScoresAction.bind(null, factoryId, date, shiftType);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  const currentValue = (area: string) => {
    const row = scores.find((s) => s.area === area);
    const value = role === "PRODUCTION" ? row?.productionScore : row?.maintenanceScore;
    return value ?? "";
  };

  const roleLabel = role === "PRODUCTION" ? "Head of Production" : "Head of Maintenance";
  const accentClass = role === "PRODUCTION" ? "border-l-sky-400" : "border-l-violet-400";

  return (
    <form
      action={formAction}
      className={`mt-2 space-y-2 rounded-md border border-l-4 border-slate-200 ${accentClass} bg-slate-50/50 p-2`}
    >
      <input type="hidden" name="scoringRole" value={role} />
      <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{roleLabel}</h5>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {CLEANING_AREAS.map((area) => (
          <FieldGroup key={area} label={CLEANING_AREA_LABEL[area]}>
            <Input
              name={`score_${area}`}
              type="number"
              min="0"
              max="10"
              defaultValue={currentValue(area)}
              className="w-16"
            />
          </FieldGroup>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : `Save ${roleLabel} scores`}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
