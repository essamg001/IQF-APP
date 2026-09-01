"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { logActivity } from "@/lib/activityLog";
import { canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";
import { STRUCTURAL_ISSUE_LOCATIONS } from "@/lib/structuralIssues";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const issueSchema = z.object({
  factoryId: z.string().min(1),
  location: z.enum(STRUCTURAL_ISSUE_LOCATIONS),
  description: z.string().min(1),
});

// Reporting is deliberately narrow, matching the Owner's own description of
// the workflow: the Head of Production writes up what he sees, not open to
// anyone who happens to notice something.
export async function createStructuralIssueAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canSignAsHeadOfProduction(session?.user)) {
    return "Only the Owner or Head of Production can report a structural issue.";
  }

  const parsed = issueSchema.safeParse({
    factoryId: formData.get("factoryId"),
    location: formData.get("location"),
    description: formData.get("description"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  // A photo is mandatory here -- it's what lets everyone downstream (maintenance,
  // the Owner) see the extent of the damage without having to walk over and look.
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return "A photo of the damage is required.";
  }
  let saved;
  try {
    saved = await saveUploadedFile(file, "structural-issue-photos");
  } catch (e) {
    return e instanceof Error ? e.message : "Could not save the uploaded photo.";
  }

  const created = await prisma.structuralIssue.create({
    data: {
      ...parsed.data,
      reportedByName: session!.user.name || session!.user.email,
      reportedByUserId: session!.user.id,
      photos: {
        create: { fileName: saved.fileName, originalName: saved.originalName, uploadedByUserId: session!.user.id },
      },
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "STRUCTURAL_ISSUE_REPORTED",
    entityType: "StructuralIssue",
    entityId: created.id,
    detail: `${parsed.data.location} — ${parsed.data.description}`,
  });

  revalidatePath("/structural-issues");
  redirect(`/structural-issues/${created.id}`);
}

const planSchema = z.object({
  proposedPlan: z.string().min(1, "A repair plan is required."),
  proposedCompletionDate: z.string().min(1, "A target completion date is required."),
});

// Confirming the damage and committing to a plan + date happen together --
// the Owner described these as one step by the maintenance team, and the
// date is what makes it possible to track whether maintenance causes delays.
export async function confirmAndPlanStructuralIssueAction(
  id: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!canSignAsHeadOfMaintenance(session?.user)) {
    return "Only the Owner or Head of Maintenance can confirm this and propose a repair plan.";
  }

  const parsed = planSchema.safeParse({
    proposedPlan: formData.get("proposedPlan"),
    proposedCompletionDate: formData.get("proposedCompletionDate"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.structuralIssue.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "REPORTED") return "This issue has already been confirmed.";

  await prisma.structuralIssue.update({
    where: { id },
    data: {
      status: "PLANNED",
      confirmedByName: session!.user.name || session!.user.email,
      confirmedByUserId: session!.user.id,
      confirmedAt: new Date(),
      proposedPlan: parsed.data.proposedPlan,
      proposedCompletionDate: new Date(parsed.data.proposedCompletionDate),
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "STRUCTURAL_ISSUE_PLANNED",
    entityType: "StructuralIssue",
    entityId: id,
    detail: `${parsed.data.proposedPlan} — target ${parsed.data.proposedCompletionDate}`,
  });

  revalidatePath(`/structural-issues/${id}`);
  revalidatePath("/structural-issues");
  return "ok";
}

const completeSchema = z.object({
  completionNotes: z.string().min(1, "Completion notes are required."),
});

export async function completeStructuralIssueAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canSignAsHeadOfMaintenance(session?.user)) {
    return "Only the Owner or Head of Maintenance can mark this as completed.";
  }

  const existing = await prisma.structuralIssue.findUniqueOrThrow({ where: { id } });
  if (existing.status !== "PLANNED") return "This issue hasn't been confirmed and planned yet.";

  const parsed = completeSchema.safeParse({ completionNotes: formData.get("completionNotes") });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.structuralIssue.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedByName: session!.user.name || session!.user.email,
      completedByUserId: session!.user.id,
      completedAt: new Date(),
      completionNotes: parsed.data.completionNotes,
    },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "STRUCTURAL_ISSUE_COMPLETED",
    entityType: "StructuralIssue",
    entityId: id,
    detail: parsed.data.completionNotes,
  });

  revalidatePath(`/structural-issues/${id}`);
  revalidatePath("/structural-issues");
  return "ok";
}

const photoSchema = z.object({
  caption: z.string().optional(),
});

export async function addStructuralIssuePhotoAction(structuralIssueId: string, formData: FormData) {
  const parsed = photoSchema.parse({ caption: formData.get("caption") || undefined });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;

  const saved = await saveUploadedFile(file, "structural-issue-photos");
  const session = await auth();

  await prisma.structuralIssuePhoto.create({
    data: {
      structuralIssueId,
      fileName: saved.fileName,
      originalName: saved.originalName,
      caption: parsed.caption,
      uploadedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "STRUCTURAL_ISSUE_PHOTO_UPLOADED",
    entityType: "StructuralIssue",
    entityId: structuralIssueId,
  });

  revalidatePath(`/structural-issues/${structuralIssueId}`);
}

export async function removeStructuralIssuePhotoAction(structuralIssueId: string, photoId: string) {
  await prisma.structuralIssuePhoto.delete({ where: { id: photoId } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "STRUCTURAL_ISSUE_PHOTO_REMOVED",
    entityType: "StructuralIssue",
    entityId: structuralIssueId,
  });

  revalidatePath(`/structural-issues/${structuralIssueId}`);
}
