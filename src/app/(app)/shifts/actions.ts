"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const shiftSchema = z
  .object({
    factoryId: z.string().min(1),
    date: z.string().min(1),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    workerCount: z.coerce.number().int().positive(),
  })
  .transform((s) => ({
    factoryId: s.factoryId,
    date: new Date(s.date),
    startTime: new Date(`${s.date}T${s.startTime}:00`),
    endTime: new Date(`${s.date}T${s.endTime}:00`),
    workerCount: s.workerCount,
  }));

export async function createShiftAction(_prevState: string | undefined, formData: FormData) {
  const parsed = shiftSchema.safeParse({
    factoryId: formData.get("factoryId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    workerCount: formData.get("workerCount"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }
  await prisma.shiftLog.create({ data: parsed.data });
  revalidatePath("/shifts");
  redirect("/shifts");
}
