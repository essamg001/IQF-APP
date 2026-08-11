"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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

const capaSchema = z.object({
  rootCause: z.string().optional(),
  correctiveAction: z.string().optional(),
});

// Root cause and corrective action are edited together -- one save, since
// they're written by the same person in the same sitting once they've
// worked out what happened. Verification (below) is deliberately separate:
// it's a distinct step, often by a different person, done later once the
// fix has had time to prove itself.
export async function updateCapaAction(issueId: string, formData: FormData) {
  const parsed = capaSchema.parse({
    rootCause: formData.get("rootCause") || undefined,
    correctiveAction: formData.get("correctiveAction") || undefined,
  });

  await prisma.qualityIssue.update({
    where: { id: issueId },
    data: parsed,
  });

  revalidatePath(`/quality-issues/${issueId}`);
}

const verifySchema = z.object({
  verificationNotes: z.string().optional(),
});

// Session-identity-based like every other sign-off in this app (Cleaning
// Mode, load-out) rather than a typed name -- and only possible once root
// cause and corrective action are both on file, since "verified" means
// "I checked the fix actually worked," not just "someone clicked a button."
export async function verifyCapaAction(issueId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to verify a corrective action.";

  const issue = await prisma.qualityIssue.findUniqueOrThrow({ where: { id: issueId } });
  if (!issue.rootCause?.trim() || !issue.correctiveAction?.trim()) {
    return "Root cause and corrective action must both be filled in before this can be verified.";
  }

  const parsed = verifySchema.parse({ verificationNotes: formData.get("verificationNotes") || undefined });

  await prisma.qualityIssue.update({
    where: { id: issueId },
    data: {
      verifiedByName: session.user.name || session.user.email,
      verifiedByUserId: session.user.id,
      verifiedAt: new Date(),
      verificationNotes: parsed.verificationNotes,
    },
  });

  revalidatePath(`/quality-issues/${issueId}`);
  return "ok";
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
