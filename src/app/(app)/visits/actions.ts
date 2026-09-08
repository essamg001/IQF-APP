"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canAccessVisits } from "@/lib/roles";

const visitSchema = z.object({
  // Omitted (the "Both Factories" option) means the visit applies to the
  // whole site -- most visits do. Only set for the rare visit genuinely
  // scoped to just one factory.
  factoryId: z.string().optional(),
  date: z.string().min(1),
  visitorNames: z.string().min(1),
  organization: z.string().min(1, "A company name is required."),
  purpose: z.string().min(1),
  isAudit: z.boolean(),
  generalFeedback: z.string().optional(),
});

export async function createFactoryVisitAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canAccessVisits(session.user)) return "You don't have permission to do this.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = visitSchema.safeParse({ ...raw, isAudit: formData.get("isAudit") === "on" });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { date, visitorNames, ...rest } = parsed.data;
  const names = visitorNames
    .split(/[\n,]/)
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length === 0) return "At least one visitor name is required.";

  const visit = await prisma.factoryVisit.create({
    data: {
      ...rest,
      visitorNames: names,
      date: new Date(date),
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "FACTORY_VISIT_LOGGED",
    entityType: "FactoryVisit",
    entityId: visit.id,
    detail: `${names.join(", ")} (${rest.organization})`,
  });

  revalidatePath("/visits");
  redirect(`/visits/${visit.id}`);
}

const findingSchema = z.object({
  category: z.enum(["STRENGTH", "ISSUE"]),
  area: z.string().optional(),
  description: z.string().min(1),
  severity: z.enum(["MINOR", "MAJOR", "CRITICAL"]).optional(),
});

export async function addAuditFindingAction(visitId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canAccessVisits(session.user)) return "You don't have permission to do this.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = findingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.clientAuditFinding.create({
    data: {
      visitId,
      category: parsed.data.category,
      area: parsed.data.area,
      description: parsed.data.description,
      severity: parsed.data.category === "ISSUE" ? parsed.data.severity : undefined,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "AUDIT_FINDING_ADDED",
    entityType: "FactoryVisit",
    entityId: visitId,
    detail: `${parsed.data.category} — ${parsed.data.description}`,
  });

  revalidatePath(`/visits/${visitId}`);
  return "ok";
}

export async function addFindingPhotoAction(visitId: string, findingId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || !canAccessVisits(session.user)) return;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const caption = (formData.get("caption") as string) || undefined;
  const saved = await saveUploadedFile(file, "audit-finding-photos");

  await prisma.clientAuditFindingPhoto.create({
    data: {
      findingId,
      fileName: saved.fileName,
      originalName: saved.originalName,
      caption,
      uploadedByUserId: session?.user.id,
    },
  });

  revalidatePath(`/visits/${visitId}`);
}

export async function removeFindingPhotoAction(visitId: string, photoId: string) {
  const session = await auth();
  if (!session?.user || !canAccessVisits(session.user)) return;

  await prisma.clientAuditFindingPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/visits/${visitId}`);
}

export async function raiseFindingAsNonConformanceAction(visitId: string, findingId: string) {
  const session = await auth();
  if (!session?.user || !canAccessVisits(session.user)) return;

  const finding = await prisma.clientAuditFinding.findUnique({
    where: { id: findingId },
    include: { visit: true },
  });
  if (!finding || finding.category !== "ISSUE" || finding.linkedNonConformanceReportId) return;

  const nc = await prisma.nonConformanceReport.create({
    data: {
      // A "Both Factories" visit (null factoryId) now maps straight onto a
      // "Both Factories" NC report -- no more guessing a single factory for
      // a finding that was never scoped to just one.
      factoryId: finding.visit.factoryId,
      date: finding.visit.date,
      location: finding.area || "—",
      description: finding.description,
      ncType: "OTHER",
      source: "EXTERNAL_AUDIT",
      reportedByName: finding.visit.visitorNames.join(", "),
    },
  });

  await prisma.clientAuditFinding.update({
    where: { id: findingId },
    data: { linkedNonConformanceReportId: nc.id },
  });

  await logActivity({
    actorId: session.user.id,
    action: "NON_CONFORMANCE_RAISED_FROM_AUDIT",
    entityType: "NonConformanceReport",
    entityId: nc.id,
    detail: finding.description,
  });

  revalidatePath(`/visits/${visitId}`);
  redirect(`/non-conformance/${nc.id}`);
}
