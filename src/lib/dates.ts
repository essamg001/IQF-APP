import { format } from "date-fns";
import { arEG } from "date-fns/locale/ar-EG";
import type { Locale as AppLocale } from "@prisma/client";

/**
 * Locale-aware date formatting -- ar-EG gives Arabic month/day names with
 * Western digits (0-9), matching how dates are actually written day-to-day
 * in Egypt (as opposed to ar-SA's Eastern Arabic numerals).
 *
 * Every call site in this app writes its pattern as "dd MMM yyyy" (an
 * abbreviated month) -- fine in English ("01 Sep 2026"), but the owner
 * wants full month names specifically in Arabic, not a shortened one
 * ("سبتمبر" not "سبتـ"). Rather than touch every call site's literal
 * pattern string, the exactly-3-M abbreviated-month token is upgraded to
 * the 4-M full-name token only when rendering Arabic -- English keeps its
 * existing abbreviated form unchanged.
 */
export function formatDate(date: Date, pattern: string, locale: AppLocale): string {
  const effectivePattern = locale === "AR" ? pattern.replace(/M{3}(?!M)/g, "MMMM") : pattern;
  return format(date, effectivePattern, locale === "AR" ? { locale: arEG } : undefined);
}

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

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addYears(d: Date, years: number): Date {
  const copy = new Date(d);
  copy.setFullYear(copy.getFullYear() + years);
  return copy;
}

export function toDateOnlyString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// The Egyptian work week (matches HSE03297/HSE03312's Sat-Fri paper grid).
export const WEEK_DAY_LABELS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

/** The Saturday on or before `d`, at local midnight -- JS getDay(): Sat=6, so days back = (getDay()+1)%7. */
export function getWeekStart(d: Date): Date {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const daysSinceSaturday = (midnight.getDay() + 1) % 7;
  return addDays(midnight, -daysSinceSaturday);
}
