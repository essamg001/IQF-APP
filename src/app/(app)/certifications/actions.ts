"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

export async function updateCertificationAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = certificationSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";
  const { data } = parsed;

  await prisma.certification.update({
    where: { id },
    data: {
      name: data.name.trim(),
      certNumber: data.certNumber,
      validTo: parseLocalDateOnly(data.validTo) ?? new Date(data.validTo),
      notes: data.notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "CERTIFICATION_UPDATED",
    entityType: "Certification",
    entityId: id,
    detail: data.name,
  });

  revalidatePath("/certifications");
  redirect("/certifications");
}

// Removing a certification outright (rather than just letting it expire) is
// a real, deliberate call -- e.g. the owner decided not to renew one -- so
// it's logged the same as every other mutation here, not silently dropped.
export async function deleteCertificationAction(id: string) {
  const session = await auth();
  if (!session?.user) return;

  const existing = await prisma.certification.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.certification.delete({ where: { id } });

  await logActivity({
    actorId: session.user.id,
    action: "CERTIFICATION_REMOVED",
    entityType: "Certification",
    entityId: id,
    detail: existing.name,
  });

  revalidatePath("/certifications");
}
