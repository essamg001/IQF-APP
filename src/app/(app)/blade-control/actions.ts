"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { raiseBladeKnifeMismatchAlert } from "@/lib/alerts";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const equipmentCheckSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  equipmentName: z.string().min(1),
  bladeType: z.string().optional(),
  replaceableBladeCount: z.coerce.number().int().nonnegative().optional(),
  soundAtInstallation: z.string().optional(),
  soundAtEndOfOperation: z.string().optional(),
  notes: z.string().optional(),
});

export async function addBladeEquipmentCheckAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = equipmentCheckSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const created = await prisma.bladeEquipmentCheck.create({
    data: {
      factoryId: parsed.data.factoryId,
      date,
      shiftType: parsed.data.shiftType,
      equipmentName: parsed.data.equipmentName,
      bladeType: parsed.data.bladeType,
      replaceableBladeCount: parsed.data.replaceableBladeCount,
      soundAtInstallation: parsed.data.soundAtInstallation === "on",
      soundAtEndOfOperation: parsed.data.soundAtEndOfOperation === "on",
      notes: parsed.data.notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "BLADE_EQUIPMENT_CHECK_ADDED",
    entityType: "BladeEquipmentCheck",
    entityId: created.id,
    detail: parsed.data.equipmentName,
  });

  revalidatePath("/blade-control");
  return "ok";
}

export async function addBladeWashEventAction(equipmentCheckId: string) {
  const session = await auth();
  if (!session?.user) return;

  await prisma.bladeWashEvent.create({ data: { equipmentCheckId } });

  await logActivity({
    actorId: session.user.id,
    action: "BLADE_WASH_EVENT_LOGGED",
    entityType: "BladeEquipmentCheck",
    entityId: equipmentCheckId,
  });

  revalidatePath("/blade-control");
}

const issueSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  workerName: z.string().min(1),
  packingGroupNumber: z.string().optional(),
  issueKnifeNumber: z.string().min(1),
});

export async function issueBladeAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = issueSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const created = await prisma.bladeIssueRecord.create({
    data: {
      factoryId: parsed.data.factoryId,
      date,
      shiftType: parsed.data.shiftType,
      workerName: parsed.data.workerName,
      packingGroupNumber: parsed.data.packingGroupNumber,
      issueKnifeNumber: parsed.data.issueKnifeNumber,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "BLADE_ISSUED",
    entityType: "BladeIssueRecord",
    entityId: created.id,
    detail: `${parsed.data.workerName} — knife #${parsed.data.issueKnifeNumber}`,
  });

  revalidatePath("/blade-control");
  return "ok";
}

const returnSchema = z.object({
  receiptKnifeNumber: z.string().min(1),
  pieceCount: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

// Only fills a still-open record -- same reasoning as ShiftLog.endTime. A
// mismatched receipt number vs. the issued number is exactly what this
// exists to catch, so it's recorded, not blocked -- Part 3 is where a real
// mismatch gets escalated.
export async function returnBladeAction(recordId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const existing = await prisma.bladeIssueRecord.findUniqueOrThrow({ where: { id: recordId } });
  if (existing.returnedAt) return "Already checked back in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = returnSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.bladeIssueRecord.update({
    where: { id: recordId },
    data: {
      returnedAt: new Date(),
      receiptKnifeNumber: parsed.data.receiptKnifeNumber,
      pieceCount: parsed.data.pieceCount,
      notes: parsed.data.notes,
    },
  });

  const isMismatch = parsed.data.receiptKnifeNumber !== existing.issueKnifeNumber;

  await logActivity({
    actorId: session.user.id,
    action: "BLADE_RETURNED",
    entityType: "BladeIssueRecord",
    entityId: recordId,
    detail: isMismatch
      ? `MISMATCH: issued #${existing.issueKnifeNumber}, returned #${parsed.data.receiptKnifeNumber}`
      : undefined,
  });

  if (isMismatch) {
    await raiseBladeKnifeMismatchAlert({
      recordId,
      workerName: existing.workerName,
      issuedKnifeNumber: existing.issueKnifeNumber,
      returnedKnifeNumber: parsed.data.receiptKnifeNumber,
    });
  }

  revalidatePath("/blade-control");
  return "ok";
}

const incidentSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  reportedByName: z.string().min(1),
  report: z.string().min(1),
  relatedReference: z.string().optional(),
  correctiveAction: z.string().optional(),
});

export async function addBladeIncidentReportAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = incidentSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const created = await prisma.bladeIncidentReport.create({
    data: {
      factoryId: parsed.data.factoryId,
      date,
      reportedByName: parsed.data.reportedByName,
      report: parsed.data.report,
      relatedReference: parsed.data.relatedReference,
      correctiveAction: parsed.data.correctiveAction,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "BLADE_INCIDENT_REPORTED",
    entityType: "BladeIncidentReport",
    entityId: created.id,
    detail: parsed.data.report,
  });

  revalidatePath("/blade-control");
  return "ok";
}
