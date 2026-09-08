"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const reportSchema = z.object({
  // Omitted (the "Both Factories" option) means the non-conformance is
  // mutual to both -- a product-wide or shared-supplier issue, not one
  // factory's problem.
  factoryId: z.string().optional(),
  date: z.string().min(1),
  location: z.string().min(1),
  productOrReference: z.string().optional(),
  ncType: z.enum(["PRODUCT", "PROCESS", "EQUIPMENT", "DOCUMENTATION", "SUPPLIER", "OTHER"]),
  source: z.enum(["INTERNAL_AUDIT", "EXTERNAL_AUDIT", "CUSTOMER_COMPLAINT", "INSPECTION", "STAFF_REPORT", "OTHER"]),
  description: z.string().min(1),
});

// Open to anyone logged in -- GEN03108 is the company-wide escalation form
// other sheets (e.g. HSE03291 personal items) point to when something needs
// formal root-cause + CAPA tracking, so it can't be gated to one role the
// way Structural Issues is.
export async function createNonConformanceReportAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { date, ...rest } = parsed.data;

  const created = await prisma.nonConformanceReport.create({
    data: {
      ...rest,
      date: new Date(date),
      reportedByName: session.user.name || session.user.email,
      reportedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "NON_CONFORMANCE_REPORTED",
    entityType: "NonConformanceReport",
    entityId: created.id,
    detail: `${parsed.data.ncType} — ${parsed.data.location}`,
  });

  revalidatePath("/non-conformance");
  redirect(`/non-conformance/${created.id}`);
}

const capaSchema = z.object({
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
  preventiveAction: z.string().optional(),
});

// Root cause + corrective + preventive action are edited together, same as
// Quality Issues' CAPA skeleton -- one save by whoever worked out what
// happened. Verification below is a separate, later step.
export async function updateNonConformanceCapaAction(reportId: string, formData: FormData) {
  const parsed = capaSchema.parse({
    rootCause: formData.get("rootCause") || undefined,
    correctiveAction: formData.get("correctiveAction") || undefined,
    preventiveAction: formData.get("preventiveAction") || undefined,
  });

  await prisma.nonConformanceReport.update({ where: { id: reportId }, data: parsed });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "NON_CONFORMANCE_CAPA_UPDATED",
    entityType: "NonConformanceReport",
    entityId: reportId,
  });

  revalidatePath(`/non-conformance/${reportId}`);
}

const verifySchema = z.object({
  verificationNotes: z.string().optional(),
});

export async function verifyNonConformanceCapaAction(
  reportId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to verify a corrective action.";

  const report = await prisma.nonConformanceReport.findUniqueOrThrow({ where: { id: reportId } });
  if (!report.rootCause?.trim() || !report.correctiveAction?.trim()) {
    return "Root cause and corrective action must both be filled in before this can be verified.";
  }

  const parsed = verifySchema.parse({ verificationNotes: formData.get("verificationNotes") || undefined });

  await prisma.nonConformanceReport.update({
    where: { id: reportId },
    data: {
      verifiedByName: session.user.name || session.user.email,
      verifiedByUserId: session.user.id,
      verifiedAt: new Date(),
      verificationNotes: parsed.verificationNotes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "NON_CONFORMANCE_VERIFIED",
    entityType: "NonConformanceReport",
    entityId: reportId,
  });

  revalidatePath(`/non-conformance/${reportId}`);
  return "ok";
}

const photoSchema = z.object({
  caption: z.string().optional(),
});

export async function addNonConformanceReportPhotoAction(reportId: string, formData: FormData) {
  const parsed = photoSchema.parse({ caption: formData.get("caption") || undefined });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const saved = await saveUploadedFile(file, "non-conformance-photos");
  const session = await auth();

  await prisma.nonConformanceReportPhoto.create({
    data: {
      nonConformanceReportId: reportId,
      fileName: saved.fileName,
      originalName: saved.originalName,
      caption: parsed.caption,
      uploadedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "NON_CONFORMANCE_PHOTO_UPLOADED",
    entityType: "NonConformanceReport",
    entityId: reportId,
  });

  revalidatePath(`/non-conformance/${reportId}`);
}

export async function removeNonConformanceReportPhotoAction(reportId: string, photoId: string) {
  await prisma.nonConformanceReportPhoto.delete({ where: { id: photoId } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "NON_CONFORMANCE_PHOTO_REMOVED",
    entityType: "NonConformanceReport",
    entityId: reportId,
  });

  revalidatePath(`/non-conformance/${reportId}`);
}
