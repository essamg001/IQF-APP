import { prisma } from "@/lib/prisma";
import { isCleaningLocked } from "@/lib/cleaning";
import { SHIFT_HOURS } from "@/lib/shiftHours";
import type { ShiftType } from "@prisma/client";

// Same rule as the manual Log Shift form (see createShiftAction): a shift
// can't start until the cleaning done between it and the one before it is
// fully signed off. Used here so auto-creating a shift from Log Production
// Lot can't become a backdoor around that gate.
export async function shiftStartBlockedReason(
  factoryId: string,
  shiftType: ShiftType,
  date: Date
): Promise<string | null> {
  const priorShiftType = shiftType === "DAY" ? "NIGHT" : "DAY";
  const priorDate = shiftType === "DAY" ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date;
  const priorCleaning = await prisma.cleaningShiftRecord.findUnique({
    where: { factoryId_date_shiftType: { factoryId, date: priorDate, shiftType: priorShiftType } },
  });
  if (!isCleaningLocked(priorCleaning)) {
    const priorLabel = priorShiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)";
    return `Cleaning sign-off for the previous shift (${priorLabel}) isn't complete — both Head of Production and Head of Maintenance must sign off in Cleaning Mode before this shift can start.`;
  }
  return null;
}

export function scheduledShiftStartTime(date: Date, shiftType: ShiftType): Date {
  const startHour = SHIFT_HOURS[shiftType][0];
  const d = new Date(date);
  d.setHours(startHour, 0, 0, 0);
  return d;
}

// Used by Log Production Lot (and anywhere else a factory-specific shift is
// needed) so "which shift is this" and its cleaning-sign-off gate can never
// drift between call sites.
export async function findOrCreateShift(
  factoryId: string,
  shiftType: ShiftType,
  date: Date
): Promise<{ shift: { id: string }; blockReason: null } | { shift: null; blockReason: string }> {
  let shift = await prisma.shiftLog.findFirst({ where: { factoryId, shiftType, date } });
  if (!shift) {
    const blockReason = await shiftStartBlockedReason(factoryId, shiftType, date);
    if (blockReason) return { shift: null, blockReason };
    shift = await prisma.shiftLog.create({
      data: { factoryId, shiftType, date, startTime: scheduledShiftStartTime(date, shiftType) },
    });
  }
  return { shift, blockReason: null };
}

// Decap's own shift, used only by Post-Decap Quality -- deliberately no
// cleaning-sign-off gate here (that gate is a specific factory's between-
// shift hygiene check, and decap isn't tied to one factory at all).
export async function findOrCreateDecapShift(date: Date, shiftType: ShiftType) {
  const existing = await prisma.decapShift.findFirst({ where: { date, shiftType } });
  if (existing) return existing;
  return prisma.decapShift.create({ data: { date, shiftType } });
}
