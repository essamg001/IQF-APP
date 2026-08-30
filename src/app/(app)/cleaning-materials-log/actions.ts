"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const consumptionSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  materialName: z.string().min(1),
  quantityUsed: z.coerce.number().positive(),
  unit: z.string().optional(),
  concentration: z.string().optional(),
  purpose: z.string().optional(),
  recordedByName: z.string().min(1),
});

export async function addCleaningMaterialConsumptionAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = consumptionSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const { date: _date, ...data } = parsed.data;

  const created = await prisma.cleaningMaterialConsumptionRecord.create({
    data: {
      ...data,
      date,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "CLEANING_MATERIAL_CONSUMPTION_LOGGED",
    entityType: "CleaningMaterialConsumptionRecord",
    entityId: created.id,
    detail: `${parsed.data.materialName} — ${parsed.data.quantityUsed}${parsed.data.unit ?? ""}`,
  });

  revalidatePath("/cleaning-materials-log");
  return "ok";
}
