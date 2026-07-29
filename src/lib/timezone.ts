// Factory operates in Egypt local time -- reports must bucket by Egypt calendar
// days/weeks/months, not whatever timezone the server happens to run in.
// Egypt has had no DST since 2014, but we still compute the offset via Intl's
// tz database rather than hardcoding UTC+2, so this stays correct if that ever
// changes again.
export const EGYPT_TIMEZONE = "Africa/Cairo";

type YMD = { year: number; month: number; day: number };

function egyptParts(date: Date): YMD {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: EGYPT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function egyptOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EGYPT_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** yyyy-MM-dd calendar date in Egypt local time, for a real instant (e.g. a DB timestamp). */
export function egyptDateKey(date: Date): string {
  const { year, month, day } = egyptParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** yyyy-MM calendar month in Egypt local time, for a real instant. */
export function egyptMonthKey(date: Date): string {
  const { year, month } = egyptParts(date);
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * A Date holding the same Y-M-D as `date`'s Egypt calendar day, at local
 * midnight in the *server's own* timezone. Not a real instant -- only safe to
 * feed into date-fns wall-clock helpers (startOfWeek, startOfMonth, format)
 * that read Y/M/D via local getters, never into instant arithmetic.
 */
export function egyptDateOnly(date: Date): Date {
  const { year, month, day } = egyptParts(date);
  return new Date(year, month - 1, day);
}

/** Formats a Date's own local Y/M/D fields as yyyy-MM-dd, with no timezone conversion. */
export function formatYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * The real instant (UTC) at which a given Egypt calendar day begins.
 * `wallClockDate` only needs to carry the target Y/M/D in its local getters
 * (e.g. the output of egyptDateOnly/startOfWeek/startOfMonth) -- its own
 * timezone/instant value is irrelevant, only the calendar fields are read.
 */
export function egyptDayStart(wallClockDate: Date): Date {
  const year = wallClockDate.getFullYear();
  const month = wallClockDate.getMonth() + 1;
  const day = wallClockDate.getDate();
  const offsetMin = egyptOffsetMinutes(wallClockDate);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - offsetMin * 60000);
}

/** Parses a "yyyy-MM-dd" or "yyyy-MM" bucket key back into a local calendar Date, for labeling/sorting. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day ?? 1);
}
