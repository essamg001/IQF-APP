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

  // Order/container/lot numbers don't overlap, so at most one of these ever
  // matches -- resolving here means a typo'd reference is visible on the
  // detail page instead of silently sitting as an unlinked string forever.
  const reference = data.relatedReference?.trim();
  let relatedOrderId: string | undefined;
  let relatedContainerId: string | undefined;
  let relatedLotId: string | undefined;
  if (reference) {
    const [order, container, lot] = await Promise.all([
      prisma.order.findUnique({ where: { orderNumber: reference } }),
      prisma.container.findUnique({ where: { containerNumber: reference } }),
      prisma.productionLot.findUnique({ where: { lotNumber: reference } }),
    ]);
    relatedOrderId = order?.id;
    relatedContainerId = container?.id;
    relatedLotId = lot?.id;
  }

  const created = await prisma.qualityIssue.create({
    data: {
      clientId: data.clientId || undefined,
      issueDate: new Date(data.issueDate),
      variety: data.variety,
      reason: data.reason,
      relatedReference: data.relatedReference,
      relatedOrderId,
      relatedContainerId,
      relatedLotId,
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
