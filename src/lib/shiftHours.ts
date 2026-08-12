import type { ShiftType } from "@prisma/client";

// Day shift 7:00 AM-7:00 PM, Night shift 7:00 PM-7:00 AM (confirmed by the
// Owner) -- used to build hourly coverage grids for checks that must happen
// once per hour per shift (metal detector, chlorine dosing).
export const SHIFT_HOURS: Record<ShiftType, number[]> = {
  DAY: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  NIGHT: [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6],
};

export function formatHour(h: number) {
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

// The Night shift's early-morning hours (0-6) fall on the calendar day
// after `shiftDate` -- everything else lands on shiftDate itself.
export function hourSlotDate(shiftDate: Date, shiftType: ShiftType, hour: number): Date {
  const d = new Date(shiftDate);
  if (shiftType === "NIGHT" && hour < 19) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

// Local (not UTC) "YYYY-MM-DDTHH:mm" for pre-filling a datetime-local input.
export function toDateTimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
