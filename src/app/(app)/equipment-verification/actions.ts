"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly, parseDateSafe } from "@/lib/dates";
import { logActivity } from "@/lib/activityLog";
import { isMetalDetectorMaintenanceLocked } from "@/lib/equipmentVerification";
import { z } from "zod";

const metalDetectorSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  recordedAt: z.string().optional(),
  equipmentNumber: z.string().optional(),
  traceabilityCode: z.string().optional(),
  ferrousDetected: z.boolean(),
  ferrousDiameterMm: z.coerce.number().optional(),
  nonFerrousDetected: z.boolean(),
  nonFerrousDiameterMm: z.coerce.number().optional(),
  stainlessDetected: z.boolean(),
  stainlessDiameterMm: z.coerce.number().optional(),
  productReleased: z.boolean(),
  correctiveAction: z.string().optional(),
});

export async function createMetalDetectorCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = metalDetectorSchema.safeParse({
    ...raw,
    ferrousDetected: formData.get("ferrousDetected") === "on",
    nonFerrousDetected: formData.get("nonFerrousDetected") === "on",
    stainlessDetected: formData.get("stainlessDetected") === "on",
    productReleased: formData.get("productReleased") === "on",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  if (!parsed.data.productReleased && !parsed.data.correctiveAction?.trim()) {
    return "Corrective action is required when the product isn't released.";
  }

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const session = await auth();
  const { date: _date, ...data } = parsed.data;

  const created = await prisma.metalDetectorCheck.create({
    data: {
      ...data,
      date,
      recordedAt: parseDateSafe(parsed.data.recordedAt) ?? new Date(),
      checkedByName: session?.user.name ?? session?.user.email ?? undefined,
      checkedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "METAL_DETECTOR_CHECK_LOGGED",
    entityType: "MetalDetectorCheck",
    entityId: created.id,
    detail: parsed.data.productReleased ? "Product released" : `Held — ${parsed.data.correctiveAction}`,
  });

  revalidatePath("/equipment-verification");
  return "ok";
}

const metalDetectorMaintenanceSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  sensitivityCheckedThreeSides: z.boolean(),
  alarmCheckedAudioVisual: z.boolean(),
  electricalPanelChecked: z.boolean(),
  beltRollersCleanChecked: z.boolean(),
});

export async function updateMetalDetectorMaintenanceAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = metalDetectorMaintenanceSchema.safeParse({
    ...raw,
    sensitivityCheckedThreeSides: formData.get("sensitivityCheckedThreeSides") === "on",
    alarmCheckedAudioVisual: formData.get("alarmCheckedAudioVisual") === "on",
    electricalPanelChecked: formData.get("electricalPanelChecked") === "on",
    beltRollersCleanChecked: formData.get("beltRollersCleanChecked") === "on",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const session = await auth();
  const { date: _date, factoryId, shiftType, ...checklist } = parsed.data;

  const existing = await prisma.metalDetectorMaintenanceCheck.findUnique({
    where: { factoryId_date_shiftType: { factoryId, date, shiftType } },
  });
  if (isMetalDetectorMaintenanceLocked(existing)) {
    return "This shift's checklist is already confirmed. Reopen it first to make changes.";
  }

  const record = await prisma.metalDetectorMaintenanceCheck.upsert({
    where: { factoryId_date_shiftType: { factoryId, date, shiftType } },
    update: { ...checklist, checkedByName: session?.user.name ?? session?.user.email ?? undefined, checkedByUserId: session?.user.id },
    create: {
      ...checklist,
      factoryId,
      date,
      shiftType,
      checkedByName: session?.user.name ?? session?.user.email ?? undefined,
      checkedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "METAL_DETECTOR_MAINTENANCE_CHECKED",
    entityType: "MetalDetectorMaintenanceCheck",
    entityId: record.id,
  });

  revalidatePath("/equipment-verification");
  return "ok";
}

const reopenMetalDetectorMaintenanceSchema = z.object({
  reason: z.string().min(1, "A reason is required to reopen this checklist."),
});

// Same explicit, logged escape hatch as Cleaning Mode / Laundry's reopen --
// clears the confirming identity (so it has to be re-confirmed against
// whatever the checklist looks like once corrected) rather than letting a
// stale confirmation silently vouch for answers that can still be edited.
export async function reopenMetalDetectorMaintenanceAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to reopen this checklist.";

  const parsed = reopenMetalDetectorMaintenanceSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const record = await prisma.metalDetectorMaintenanceCheck.findUnique({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
  });
  if (!isMetalDetectorMaintenanceLocked(record)) return "This checklist isn't confirmed -- there's nothing to reopen.";

  await prisma.metalDetectorMaintenanceCheck.update({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
    data: {
      checkedByName: null,
      checkedByUserId: null,
      reopenedAt: new Date(),
      reopenedReason: parsed.data.reason,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "METAL_DETECTOR_MAINTENANCE_REOPENED",
    entityType: "MetalDetectorMaintenanceCheck",
    entityId: `${factoryId}:${date}:${shiftType}`,
    detail: `Cleared confirmation (was: ${record?.checkedByName ?? "—"}) — ${parsed.data.reason}`,
  });

  revalidatePath("/equipment-verification");
  return "ok";
}

const chlorineSetPointSchema = z.object({
  chlorineSetPointPpm: z.coerce.number().optional(),
});

// The dosing pump's own target reading -- an equipment configuration, not a
// per-check value (see Factory.chlorineSetPointPpm's schema comment).
export async function updateChlorineSetPointAction(factoryId: string, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = chlorineSetPointSchema.safeParse(raw);
  if (!parsed.success) return;

  await prisma.factory.update({
    where: { id: factoryId },
    data: { chlorineSetPointPpm: parsed.data.chlorineSetPointPpm ?? null },
  });
  revalidatePath("/equipment-verification");
}

const chlorineDosingSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  recordedAt: z.string().optional(),
  phLevel: z.coerce.number().optional(),
  freeChlorinePpm: z.coerce.number().optional(),
  fruitTransitSeconds: z.coerce.number().optional(),
  deviationOccurred: z.boolean(),
  correctiveAction: z.string().optional(),
  verifiedOk: z.boolean(),
});

export async function createChlorineDosingCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = chlorineDosingSchema.safeParse({
    ...raw,
    deviationOccurred: formData.get("deviationOccurred") === "on",
    verifiedOk: formData.get("verifiedOk") === "on",
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  if (parsed.data.deviationOccurred && !parsed.data.correctiveAction?.trim()) {
    return "Corrective action is required when a deviation occurred.";
  }

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const session = await auth();
  const { date: _date, ...data } = parsed.data;

  const created = await prisma.chlorineDosingCheck.create({
    data: {
      ...data,
      date,
      recordedAt: parseDateSafe(parsed.data.recordedAt) ?? new Date(),
      verifiedByName: session?.user.name ?? session?.user.email ?? undefined,
      verifiedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "CHLORINE_DOSING_CHECK_LOGGED",
    entityType: "ChlorineDosingCheck",
    entityId: created.id,
    detail: parsed.data.deviationOccurred ? `Deviation — ${parsed.data.correctiveAction}` : "Within standard",
  });

  revalidatePath("/equipment-verification");
  return "ok";
}
