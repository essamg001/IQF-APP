import type { CleaningArea } from "@prisma/client";

export const CLEANING_AREAS: CleaningArea[] = [
  "ARRIVAL",
  "PRE_COOLING",
  "PROCESSING",
  "PACKAGING",
  "COLD_STORES_AND_CORRIDORS",
  "LOAD_OUT",
  "DRY_STORAGE_ROOMS",
];

export const CLEANING_AREA_LABEL: Record<CleaningArea, string> = {
  ARRIVAL: "Arrival",
  PRE_COOLING: "Pre-Cooling",
  PROCESSING: "Processing",
  PACKAGING: "Packaging",
  COLD_STORES_AND_CORRIDORS: "Cold Stores & Corridors",
  LOAD_OUT: "Load Out",
  DRY_STORAGE_ROOMS: "Dry Storage Rooms",
};

/** A shift's cleaning record is locked (like a container manifest) once both sign-offs are on file. */
export function isCleaningLocked(
  record: { productionSignedAt: Date | null; maintenanceSignedAt: Date | null } | null | undefined
): boolean {
  return !!record?.productionSignedAt && !!record?.maintenanceSignedAt;
}

// Same green/amber/red scanning convention as the CFU tier badge and grade
// badges elsewhere in the app -- a quick visual read on a 0-10 score.
export function cleaningScoreColor(score: number | null | undefined): string {
  if (score == null) return "text-slate-300";
  if (score >= 8) return "text-emerald-700";
  if (score >= 5) return "text-amber-700";
  return "text-red-700";
}

// Matches cleaningScoreColor's red tier -- the same boundary that already
// reads as "bad" everywhere a score is shown, reused here to flag it in
// history/summary views.
export const CLEANING_LOW_SCORE_THRESHOLD = 5;

export function isLowCleaningScore(score: number | null | undefined): boolean {
  return score != null && score < CLEANING_LOW_SCORE_THRESHOLD;
}
