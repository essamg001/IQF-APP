"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { raiseScaleOutOfToleranceAlert } from "@/lib/alerts";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const scaleSchema = z.object({
  factoryId: z.string().min(1),
  scaleNumber: z.string().min(1),
  location: z.string().optional(),
  targetWeightKg: z.coerce.number().positive(),
  sensitivity: z.string().optional(),
  refValueKg: z.coerce.number().positive().optional(),
  maxPermissibleErrorG: z.coerce.number().positive(),
});

export async function addWeighingScaleAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = scaleSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.weighingScale.create({ data: parsed.data });

  await logActivity({
    actorId: session.user.id,
    action: "WEIGHING_SCALE_REGISTERED",
    entityType: "WeighingScale",
    entityId: created.id,
    detail: `Scale #${parsed.data.scaleNumber}`,
  });

  revalidatePath("/scale-calibration");
  return "ok";
}

const checkSchema = z.object({
  scaleId: z.string().min(1),
  date: z.string().min(1),
  deviationG: z.coerce.number(),
  verifiedByName: z.string().optional(),
  notes: z.string().optional(),
});

// Upsert by (scaleId, date) -- one check per scale per day, matching the
// printed form's one-column-per-day-of-month layout. Re-submitting the same
// day corrects that day's reading rather than creating a duplicate.
export async function addScaleCalibrationCheckAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = checkSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const scale = await prisma.weighingScale.findUniqueOrThrow({ where: { id: parsed.data.scaleId } });

  const { scaleId, date: _d, ...data } = parsed.data;
  const upserted = await prisma.scaleCalibrationCheck.upsert({
    where: { scaleId_date: { scaleId, date } },
    update: data,
    create: { scaleId, date, ...data },
  });

  const outOfTolerance = Math.abs(data.deviationG) > scale.maxPermissibleErrorG;

  await logActivity({
    actorId: session.user.id,
    action: "SCALE_CALIBRATION_CHECKED",
    entityType: "ScaleCalibrationCheck",
    entityId: upserted.id,
    detail: outOfTolerance ? `OUT OF TOLERANCE: ${data.deviationG}g (limit ±${scale.maxPermissibleErrorG}g)` : undefined,
  });

  if (outOfTolerance) {
    await raiseScaleOutOfToleranceAlert({
      scaleId: scale.id,
      scaleNumber: scale.scaleNumber,
      deviationG: data.deviationG,
      maxPermissibleErrorG: scale.maxPermissibleErrorG,
    });
  }

  revalidatePath("/scale-calibration");
  return "ok";
}
