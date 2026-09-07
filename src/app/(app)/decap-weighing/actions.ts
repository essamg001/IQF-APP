"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { findOrCreateDecapShift } from "@/lib/shifts";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const weighingSchema = z.object({
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  weighingType: z.enum(["INTAKE", "PRODUCT_EXIT", "CALYX", "REJECTED"]),
  packHouse: z.string().optional(),
  serialNumber: z.string().optional(),
  vehicleNumber: z.string().optional(),
  firstWeightKg: z.coerce.number().nonnegative().optional(),
  secondWeightKg: z.coerce.number().nonnegative().optional(),
  emptyCratesDeductionKg: z.coerce.number().nonnegative().optional(),
  farmSupplierName: z.string().optional(),
  varietyName: z.string().optional(),
  cratesIn: z.coerce.number().int().nonnegative().optional(),
  cratesOut: z.coerce.number().int().nonnegative().optional(),
  recordedByName: z.string().optional(),
});

export async function addDecapWeighingAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = weighingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  // CALYX/REJECTED are a single reading, never a two-stage weighing (owner
  // confirmed 2026-09-07) -- ignore any secondWeightKg submitted for those,
  // rather than silently accepting a value that shouldn't apply.
  const isSingleReading = parsed.data.weighingType === "CALYX" || parsed.data.weighingType === "REJECTED";

  const shift = await findOrCreateDecapShift(date, parsed.data.shiftType);
  const { date: _d, shiftType: _s, ...rest } = parsed.data;

  const created = await prisma.decapWeighing.create({
    data: {
      ...rest,
      secondWeightKg: isSingleReading ? undefined : rest.secondWeightKg,
      decapShiftId: shift.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "DECAP_WEIGHING_RECORDED",
    entityType: "DecapWeighing",
    entityId: created.id,
    detail: `${parsed.data.weighingType}${parsed.data.packHouse ? ` — ${parsed.data.packHouse}` : ""}`,
  });

  revalidatePath("/decap-weighing");
  revalidatePath("/daily-report");
  return "ok";
}

export async function removeDecapWeighingAction(id: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.decapWeighing.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "DECAP_WEIGHING_REMOVED",
    entityType: "DecapWeighing",
    entityId: id,
  });

  revalidatePath("/decap-weighing");
  revalidatePath("/daily-report");
}
