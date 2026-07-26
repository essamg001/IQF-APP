"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

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

  await prisma.shiftLog.create({
    data: { factoryId: parsed.data.factoryId, shiftType: parsed.data.shiftType, workerCount: parsed.data.workerCount, date, startTime, endTime },
  });
  revalidatePath("/shifts");
  redirect("/shifts");
}
