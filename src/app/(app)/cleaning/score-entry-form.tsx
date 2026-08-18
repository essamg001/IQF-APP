"use client";

import { useActionState } from "react";
import { updateCleaningScoresAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CLEANING_AREAS } from "@/lib/cleaning";
import type { CleaningArea } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const fullDict = useTranslations();
  const dict = fullDict.cleaningMode;

  const AREA_LABEL: { [key in CleaningArea]: string } = {
    ARRIVAL: dict.areaArrival,
    PRE_COOLING: dict.areaPreCooling,
    PROCESSING: dict.areaProcessing,
    PACKAGING: dict.areaPackaging,
    COLD_STORES_AND_CORRIDORS: dict.areaColdStoresAndCorridors,
    LOAD_OUT: dict.areaLoadOut,
    DRY_STORAGE_ROOMS: dict.areaDryStorageRooms,
  };

  const currentValue = (area: string) => {
    const row = scores.find((s) => s.area === area);
    const value = role === "PRODUCTION" ? row?.productionScore : row?.maintenanceScore;
    return value ?? "";
  };

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="scoringRole" value={role} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {CLEANING_AREAS.map((area) => (
          <FieldGroup key={area} label={AREA_LABEL[area]}>
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
        <Button type="submit" variant="secondary" className="text-xs" disabled={pending}>
          {pending ? fullDict.common.saving : dict.saveScores}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
