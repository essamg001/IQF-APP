"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const sprayFormSchema = z.object({
  fieldName: z.string().min(1, "Field is required."),
  chemicalName: z.string().min(1, "Chemical / product is required."),
  sprayDate: z.string().min(1, "Spray date is required."),
  noHarvestDays: z.coerce.number().int().min(0).default(12),
  sprayedByName: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export async function createFieldSprayAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY"].includes(session.user.role)) {
    return "Only the Owner or Quality can log a field spray.";
  }

  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = sprayFormSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName.trim() } });
  if (!field) {
    return `Field "${parsed.data.fieldName}" not found — pick one from the list.`;
  }

  const sprayDate = parseLocalDateOnly(parsed.data.sprayDate);
  if (!sprayDate) return "Invalid spray date.";

  const { fieldName, sprayDate: _sprayDateRaw, ...data } = parsed.data;

  const created = await prisma.fieldSprayRecord.create({
    data: {
      ...data,
      fieldId: field.id,
      sprayDate,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "FIELD_SPRAY_LOGGED",
    entityType: "FieldSprayRecord",
    entityId: created.id,
    detail: `${field.name} — ${data.chemicalName} (${data.noHarvestDays}-day no-harvest)`,
  });

  revalidatePath("/field-spray-log");
  redirect("/field-spray-log");
}
