"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activityLog";
import { LABOUR_DEPARTMENTS } from "@/lib/labour";

const supervisorTrainingSchema = z.object({
  supervisorName: z.string().min(1),
  trainingType: z.string().min(1),
  trainedDate: z.string().min(1),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function addSupervisorTrainingAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = supervisorTrainingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  const { data } = parsed;

  const created = await prisma.supervisorTrainingRecord.create({
    data: {
      supervisorName: data.supervisorName.trim(),
      trainingType: data.trainingType.trim(),
      trainedDate: new Date(data.trainedDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      notes: data.notes,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "SUPERVISOR_TRAINING_RECORDED",
    entityType: "SupervisorTrainingRecord",
    entityId: created.id,
    detail: `${created.supervisorName} — ${created.trainingType}`,
  });

  revalidatePath("/training");
  return "ok";
}

const departmentTrainingSchema = z.object({
  factoryId: z.string().min(1),
  department: z.enum(LABOUR_DEPARTMENTS as [string, ...string[]]),
  trainingType: z.string().min(1),
  trainedDate: z.string().min(1),
  trainedCount: z.coerce.number().int().min(0),
  totalCount: z.coerce.number().int().min(1),
  notes: z.string().optional(),
});

export async function addDepartmentTrainingAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = departmentTrainingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  const { data } = parsed;

  if (data.trainedCount > data.totalCount) return "Trained count can't exceed total headcount.";

  const created = await prisma.departmentTrainingRecord.create({
    data: {
      factoryId: data.factoryId,
      department: data.department as never,
      trainingType: data.trainingType.trim(),
      trainedDate: new Date(data.trainedDate),
      trainedCount: data.trainedCount,
      totalCount: data.totalCount,
      notes: data.notes,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "DEPARTMENT_TRAINING_RECORDED",
    entityType: "DepartmentTrainingRecord",
    entityId: created.id,
    detail: `${created.department} — ${created.trainingType} (${created.trainedCount}/${created.totalCount})`,
  });

  revalidatePath("/training");
  return "ok";
}
