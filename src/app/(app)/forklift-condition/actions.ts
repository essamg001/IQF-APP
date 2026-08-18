"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const equipmentSchema = z.object({
  factoryId: z.string().min(1),
  equipmentType: z.enum(["DIESEL_CLARK", "ELECTRIC_CLARK", "POWER_PALLET"]),
  equipmentNumber: z.string().min(1),
  glassPlasticPartsCount: z.coerce.number().int().nonnegative().optional(),
  glassPlasticPartsDescription: z.string().optional(),
});

export async function addForkliftEquipmentAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = equipmentSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.forkliftEquipment.create({ data: parsed.data });

  await logActivity({
    actorId: session.user.id,
    action: "FORKLIFT_EQUIPMENT_ADDED",
    entityType: "ForkliftEquipment",
    entityId: created.id,
    detail: `${parsed.data.equipmentType} #${parsed.data.equipmentNumber}`,
  });

  revalidatePath("/forklift-condition");
  return "ok";
}

const checkSchema = z.object({
  equipmentId: z.string().min(1),
  date: z.string().min(1),
  glassPlasticIntact: z.string().optional(),
  cleaningMaterialsUsed: z.string().optional(),
  concentrationUsed: z.string().optional(),
  cleanedByName: z.string().optional(),
  checkedByName: z.string().optional(),
  notes: z.string().optional(),
});

// Upsert by (equipmentId, date) -- one check per equipment per day, matching
// the printed form's one-row-per-day-of-month layout. Re-submitting the same
// day corrects that day's row rather than creating a duplicate.
export async function addForkliftConditionCheckAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = checkSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const { equipmentId, date: _d, glassPlasticIntact, ...rest } = parsed.data;
  const data = { ...rest, glassPlasticIntact: glassPlasticIntact === "on" };

  const upserted = await prisma.forkliftConditionCheck.upsert({
    where: { equipmentId_date: { equipmentId, date } },
    update: data,
    create: { equipmentId, date, ...data },
  });

  await logActivity({
    actorId: session.user.id,
    action: "FORKLIFT_CONDITION_CHECKED",
    entityType: "ForkliftConditionCheck",
    entityId: upserted.id,
    detail: data.glassPlasticIntact ? undefined : "Glass/plastic NOT intact",
  });

  revalidatePath("/forklift-condition");
  return "ok";
}
