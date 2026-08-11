"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activityLog";

const staffTrainingSchema = z.object({
  tier: z.enum(["SUPERVISOR", "WORKER"]),
  attendeeName: z.string().min(1),
  jobTitle: z.string().optional(),
  gender: z.string().optional(),
  trainingType: z.string().min(1),
  trainedDate: z.string().min(1),
  expiryDate: z.string().optional(),
  provider: z.string().optional(),
  trainerName: z.string().optional(),
  notes: z.string().optional(),
});

export async function addStaffTrainingAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = staffTrainingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  const { data } = parsed;

  const created = await prisma.staffTrainingRecord.create({
    data: {
      tier: data.tier,
      attendeeName: data.attendeeName.trim(),
      jobTitle: data.jobTitle,
      gender: data.gender,
      trainingType: data.trainingType.trim(),
      trainedDate: new Date(data.trainedDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      provider: data.provider,
      trainerName: data.trainerName,
      notes: data.notes,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "STAFF_TRAINING_RECORDED",
    entityType: "StaffTrainingRecord",
    entityId: created.id,
    detail: `${created.attendeeName} — ${created.trainingType}`,
  });

  revalidatePath("/training");
  return "ok";
}
