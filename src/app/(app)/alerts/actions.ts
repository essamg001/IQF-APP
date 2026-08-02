"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { raiseQualityOverrideAlert } from "@/lib/alerts";
import { logActivity } from "@/lib/activityLog";

export async function markAlertReadAction(alertId: string) {
  await prisma.alert.update({ where: { id: alertId }, data: { status: "READ" } });
  revalidatePath("/alerts");
}

async function resolveRelatedAlerts(checkId: string) {
  await prisma.alert.updateMany({
    where: { relatedEntityId: checkId, type: "QUALITY_LIMIT_EXCEEDED" },
    data: { status: "READ" },
  });
}

export async function rejectQualityCheckAction(checkId: string) {
  const session = await auth();
  await prisma.qualityCheck.update({
    where: { id: checkId },
    data: {
      overrideStatus: "REJECTED",
      overrideByName: session?.user.name ?? session?.user.email ?? "Unknown",
      overrideAt: new Date(),
    },
  });
  await resolveRelatedAlerts(checkId);
  await logActivity({
    actorId: session?.user.id,
    action: "QUALITY_CHECK_REJECTED",
    entityType: "QualityCheck",
    entityId: checkId,
  });
  revalidatePath("/alerts");
}

const approveAtRiskSchema = z.object({
  name: z.string().min(1, "Name is required."),
  signature: z.string().min(1, "Signature is required."),
  note: z.string().optional(),
});

export async function approveAtRiskAction(checkId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = approveAtRiskSchema.safeParse({
    name: formData.get("name"),
    signature: formData.get("signature"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const originalAlert = await prisma.alert.findFirst({
    where: { relatedEntityId: checkId, type: "QUALITY_LIMIT_EXCEEDED" },
  });

  await prisma.qualityCheck.update({
    where: { id: checkId },
    data: {
      overrideStatus: "APPROVED_AT_RISK",
      overrideByName: parsed.data.name,
      overrideSignature: parsed.data.signature,
      overrideNote: parsed.data.note,
      overrideAt: new Date(),
    },
  });
  await resolveRelatedAlerts(checkId);

  // Every manager/owner needs to know this decision was made, independent of
  // whoever happened to be looking at this specific alert -- taking the risk
  // on out-of-spec produce is exactly the kind of call that shouldn't stay
  // known only to the person who made it.
  await raiseQualityOverrideAlert({
    checkId,
    originalMessage: originalAlert?.message ?? "An out-of-spec quality check",
    approvedByName: parsed.data.name,
    note: parsed.data.note,
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "QUALITY_OVERRIDE_APPROVED_AT_RISK",
    entityType: "QualityCheck",
    entityId: checkId,
    detail: `Approved by ${parsed.data.name}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
  });

  revalidatePath("/alerts");
  return "ok";
}
