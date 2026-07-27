"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const qualityIssueSchema = z.object({
  clientId: z.string().optional(),
  issueDate: z.string().min(1),
  variety: z.string().optional(),
  reason: z.enum(["QUALITY", "PACKAGING", "FOREIGN_MATERIAL", "TRANSPORT"]),
  relatedReference: z.string().optional(),
  issueDetails: z.string().optional(),
  correctiveAction: z.string().optional(),
});

export async function createQualityIssueAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = qualityIssueSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }
  const { data } = parsed;

  const created = await prisma.qualityIssue.create({
    data: {
      clientId: data.clientId || undefined,
      issueDate: new Date(data.issueDate),
      variety: data.variety,
      reason: data.reason,
      relatedReference: data.relatedReference,
      issueDetails: data.issueDetails,
      correctiveAction: data.correctiveAction,
    },
  });

  revalidatePath("/quality-issues");
  redirect(`/quality-issues/${created.id}`);
}

const updateSchema = z.object({
  correctiveAction: z.string().optional(),
});

export async function updateCorrectiveActionAction(issueId: string, formData: FormData) {
  const parsed = updateSchema.parse({
    correctiveAction: formData.get("correctiveAction") || undefined,
  });

  await prisma.qualityIssue.update({
    where: { id: issueId },
    data: { correctiveAction: parsed.correctiveAction },
  });

  revalidatePath(`/quality-issues/${issueId}`);
}

export async function toggleQualityIssueStatusAction(issueId: string) {
  const issue = await prisma.qualityIssue.findUniqueOrThrow({ where: { id: issueId } });
  await prisma.qualityIssue.update({
    where: { id: issueId },
    data: { status: issue.status === "OPEN" ? "RESOLVED" : "OPEN" },
  });

  revalidatePath(`/quality-issues/${issueId}`);
  revalidatePath("/quality-issues");
}
