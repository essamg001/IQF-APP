"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const plantingDataSchema = z.object({
  plantingDate: z.string().optional(),
  avgTonPerFeddan: z.coerce.number().min(0).optional(),
});

export async function updateFieldPlantingDataAction(fieldId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    return "Not authorized.";
  }

  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = plantingDataSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  await prisma.field.update({
    where: { id: fieldId },
    data: {
      plantingDate: parsed.data.plantingDate ?? null,
      avgTonPerFeddan: parsed.data.avgTonPerFeddan ?? null,
    },
  });

  revalidatePath("/fields");
  return "ok";
}
