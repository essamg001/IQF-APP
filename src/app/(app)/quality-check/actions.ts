"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { limitsFor, checkQualityLimits } from "@/lib/qualityLimits";
import type { QualityCheckpoint } from "@prisma/client";

// Where "back to the log" goes after a delete -- one listing page per checkpoint.
const CHECKPOINT_PATH: Record<QualityCheckpoint, string> = {
  PRE_DECAP: "/pre-decap-inspection",
  RAW_MATERIAL: "/arrival-inspection",
  POST_DECAP: "/post-decap-quality",
  POST_PACKAGING: "/post-freeze-inspection",
};

async function requireEditor() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    return null;
  }
  return session;
}

// Generic across every checkpoint -- limitsFor() already enumerates exactly
// which fields a given checkpoint measures, so this doesn't need a bespoke
// schema per checkpoint the way the create forms do.
export async function updateQualityCheckAction(checkId: string, formData: FormData) {
  const session = await requireEditor();
  if (!session) return;

  const check = await prisma.qualityCheck.findUnique({ where: { id: checkId }, include: { lot: true } });
  if (!check) return;

  const rules = limitsFor(check.checkpoint, check.lot?.grade, check.lot?.format);
  const values: Record<string, number | null> = {};
  for (const rule of rules) {
    const raw = formData.get(rule.field);
    values[rule.field] = raw === null || raw === "" ? null : Number(raw);
  }

  const notes = formData.get("notes");

  const violations = checkQualityLimits(check.checkpoint, values, check.lot?.grade, check.lot?.format);
  const decision: "ACCEPTED" | "REJECTED" = violations.length === 0 ? "ACCEPTED" : "REJECTED";

  await prisma.qualityCheck.update({
    where: { id: checkId },
    data: {
      ...values,
      notes: typeof notes === "string" && notes.trim() ? notes : null,
      decision,
    },
  });

  revalidatePath(`/quality-check/${checkId}`);
  redirect(`/quality-check/${checkId}`);
}

export async function deleteQualityCheckAction(checkId: string) {
  const session = await requireEditor();
  if (!session) return;

  const check = await prisma.qualityCheck.findUnique({ where: { id: checkId } });
  if (!check) return;

  await prisma.qualityCheck.delete({ where: { id: checkId } });

  revalidatePath(CHECKPOINT_PATH[check.checkpoint]);
  redirect(CHECKPOINT_PATH[check.checkpoint]);
}
