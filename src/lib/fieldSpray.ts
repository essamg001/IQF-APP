import { addDays } from "@/lib/dates";

export type SprayRecordLike = { sprayDate: Date; noHarvestDays: number };

export function sprayClearDate(spray: SprayRecordLike): Date {
  return addDays(spray.sprayDate, spray.noHarvestDays);
}

/**
 * The spray record (if any) that still restricts harvest as of `asOf` --
 * i.e. its clear date hasn't passed yet. A field can have several spray
 * records on file; if more than one is still active, the one that clears
 * latest is the binding constraint.
 */
export function activeRestriction<T extends SprayRecordLike>(sprays: T[], asOf: Date = new Date()): T | null {
  const active = sprays.filter((s) => sprayClearDate(s) > asOf);
  if (active.length === 0) return null;
  return active.reduce((latest, s) => (sprayClearDate(s) > sprayClearDate(latest) ? s : latest));
}
