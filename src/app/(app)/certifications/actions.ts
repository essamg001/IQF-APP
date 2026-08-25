"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";

const certificationSchema = z.object({
  name: z.string().min(1),
  certNumber: z.string().optional(),
  validTo: z.string().min(1),
  notes: z.string().optional(),
});

export async function addCertificationAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = certificationSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  const { data } = parsed;

  const created = await prisma.certification.create({
    data: {
      name: data.name.trim(),
      certNumber: data.certNumber,
      validTo: parseLocalDateOnly(data.validTo) ?? new Date(data.validTo),
      notes: data.notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "CERTIFICATION_RECORDED",
    entityType: "Certification",
    entityId: created.id,
    detail: created.name,
  });

  revalidatePath("/certifications");
  return "ok";
}
