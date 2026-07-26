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
