"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canSeeCosting } from "@/lib/roles";
import { logActivity } from "@/lib/activityLog";
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
  endTime: z.string().min(1),
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
  let endTime = combineDateAndTime(parsed.data.date, parsed.data.endTime);
  if (!date || !startTime || !endTime) {
    return "That date or time couldn't be read — please re-enter it.";
  }
  // Night shifts cross midnight (e.g. 18:00-02:00): if the end time isn't
  // after the start time, it belongs to the following day.
  if (endTime <= startTime) {
    endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
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

  const session = await auth();
  const valueUsdRaw = formData.get("valueUsd");
  const valueUsd = canSeeCosting(session?.user) && valueUsdRaw ? Number(valueUsdRaw) : undefined;

  await prisma.waste.create({
    data: {
      shiftId,
      quantity: parsed.data.rejectedWeightKg / 1000,
      reason: parsed.data.reason,
      valueUsd,
    },
  });

  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts");
  revalidatePath("/waste");
  return "ok";
}

const shiftCostingSchema = z.object({
  rawMaterialCostEgp: z.coerce.number().nonnegative().optional(),
  laborHourlyRateEgpSnapshot: z.coerce.number().nonnegative().optional(),
});

// Costing is entered after the fact (once the day/week's numbers are known),
// separate from the shift-creation form. canSeeCosting-gated server-side --
// same reasoning as requireOwner() elsewhere: the page hides the form from
// unauthorized roles, but a Server Action is its own callable endpoint.
export async function updateShiftCostingAction(shiftId: string, formData: FormData) {
  const session = await auth();
  if (!canSeeCosting(session?.user)) return;

  const parsed = shiftCostingSchema.parse({
    rawMaterialCostEgp: formData.get("rawMaterialCostEgp") || undefined,
    laborHourlyRateEgpSnapshot: formData.get("laborHourlyRateEgpSnapshot") || undefined,
  });

  await prisma.shiftLog.update({ where: { id: shiftId }, data: parsed });

  await logActivity({
    actorId: session?.user.id,
    action: "SHIFT_COSTING_UPDATED",
    entityType: "ShiftLog",
    entityId: shiftId,
  });

  revalidatePath(`/shifts/${shiftId}`);
}
