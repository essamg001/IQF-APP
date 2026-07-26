/**
 * Parses a date/datetime-local input value, returning undefined for anything
 * that doesn't produce a valid Date (locale/keyboard quirks on some devices
 * can send unparseable strings). A bad optional timestamp should never block
 * the rest of a submission from being saved.
 */
export function parseDateSafe(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Parses a "YYYY-MM-DD" date-only input into local midnight using numeric
 * Date components -- `new Date("YYYY-MM-DD")` parses as UTC midnight, which
 * can land on the wrong local day. Callers matching this against a
 * ShiftLog.date (built the same way, see shifts/actions.ts) must use this
 * instead of parseDateSafe.
 */
export function parseLocalDateOnly(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}
