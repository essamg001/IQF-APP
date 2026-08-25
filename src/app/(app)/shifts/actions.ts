"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isCleaningLocked } from "@/lib/cleaning";

// Builds a Date from separate "YYYY-MM-DD" and "HH:MM"(:SS) strings using
// numeric components rather than string concatenation -- a `<input
// type="time">` occasionally reports seconds ("HH:MM:SS"), which broke the
// old `${date}T${time}:00` template (producing an invalid double-seconds
// string and an Invalid Date that crashed the whole submission).
function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const [year, month, day] = dateParts;
  const [hours, minutes] = timeParts;
  if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return null;
  const d = new Date(year, month - 1, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d;
}

const shiftSchema = z.object({
  factoryId: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  workerCount: z.coerce.number().int().positive(),
});

export async function createShiftAction(_prevState: string | undefined, formData: FormData) {
  const parsed = shiftSchema.safeParse({
    factoryId: formData.get("factoryId"),
    shiftType: formData.get("shiftType"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    workerCount: formData.get("workerCount"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const date = combineDateAndTime(parsed.data.date, "00:00");
  const startTime = combineDateAndTime(parsed.data.date, parsed.data.startTime);
  if (!date || !startTime) {
    return "That date or time couldn't be read — please re-enter it.";
  }
  // End time isn't asked for at shift-open -- it gets filled in automatically
  // once the day's Daily Report records this shift's line uptime (see
  // updateLineEfficiencyAction). Only set here if someone already knows it
  // and typed it in (e.g. logging a shift retroactively).
  let endTime: Date | null = null;
  if (parsed.data.endTime) {
    endTime = combineDateAndTime(parsed.data.date, parsed.data.endTime);
    if (!endTime) return "That date or time couldn't be read — please re-enter it.";
    // Night shifts cross midnight (e.g. 18:00-02:00): if the end time isn't
    // after the start time, it belongs to the following day.
    if (endTime <= startTime) {
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  // A shift can't start until the cleaning done between it and the one
  // before it is fully signed off -- DAY follows the previous calendar
  // day's NIGHT cleaning; NIGHT follows the same day's DAY cleaning (see
  // CleaningShiftRecord's doc comment in schema.prisma).
  const priorShiftType = parsed.data.shiftType === "DAY" ? "NIGHT" : "DAY";
  const priorDate = parsed.data.shiftType === "DAY" ? new Date(date.getTime() - 24 * 60 * 60 * 1000) : date;
  const priorCleaning = await prisma.cleaningShiftRecord.findUnique({
    where: {
      factoryId_date_shiftType: { factoryId: parsed.data.factoryId, date: priorDate, shiftType: priorShiftType },
    },
  });
  if (!isCleaningLocked(priorCleaning)) {
    const priorLabel = priorShiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)";
    return `Cleaning sign-off for the previous shift (${priorLabel}) isn't complete — both Head of Production and Head of Maintenance must sign off in Cleaning Mode before this shift can start.`;
  }

  // A shift may already have been auto-created (e.g. by logging a Production
  // Lot or a Post-Decap Quality check before anyone opened it by hand here) --
  // ShiftLog's unique (factoryId, date, shiftType) means a second create would
  // otherwise throw a raw database error instead of this friendly message.
  const existingShift = await prisma.shiftLog.findFirst({
    where: { factoryId: parsed.data.factoryId, shiftType: parsed.data.shiftType, date },
  });
  if (existingShift) {
    return "This shift has already been logged (it may have been created automatically by an earlier lot or quality check) — see it below.";
  }

  await prisma.shiftLog.create({
    data: { factoryId: parsed.data.factoryId, shiftType: parsed.data.shiftType, workerCount: parsed.data.workerCount, date, startTime, endTime },
  });
  revalidatePath("/shifts");
  redirect("/shifts");
}

const shiftWasteSchema = z.object({
  rejectedWeightKg: z.coerce.number().positive(),
  reason: z.string().min(1),
});

// Reject fruit is pulled off the inspection belt
// continuously through the shift, not weighed per rejection -- it's gathered
// and weighed once, at the end of the shift. So this logs against the shift
// as a whole, not any single QualityCheck or pallet (neither exists yet for
// raw material that never made it into a lot).
export async function logShiftRejectWasteAction(shiftId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = shiftWasteSchema.safeParse({
    rejectedWeightKg: formData.get("rejectedWeightKg"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.waste.create({
    data: {
      shiftId,
      quantity: parsed.data.rejectedWeightKg / 1000,
      reason: parsed.data.reason,
    },
  });

  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts");
  revalidatePath("/waste");
  return "ok";
}

