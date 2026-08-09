"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { parseDateSafe } from "@/lib/dates";
import { raiseMicrobiologyRejectionAlert, raiseShiftOnHoldAlert } from "@/lib/alerts";
import { isSplitResult } from "@/lib/microbiology";
import { CFU_REJECT_TIER } from "@/lib/cfuTier";
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sendSchema = z.object({
  labName: z.string().optional(),
  sentDate: z.string().optional(),
});

export async function markSentToLabAction(resultId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = sendSchema.parse(raw);
  const session = await auth();

  // The tracking reference for a dispatched sample is just the lot number --
  // every lot gets tested, so the lot number already is the unique
  // identifier the physical sample should be labelled with, rather than a
  // separately invented code that could drift from it.
  const existing = await prisma.microbiologyResult.findUniqueOrThrow({
    where: { id: resultId },
    include: { lot: true },
  });

  const updated = await prisma.microbiologyResult.update({
    where: { id: resultId },
    data: {
      status: "SENT_TO_LAB",
      labName: parsed.labName,
      trackingRef: existing.lot.lotNumber,
      sentDate: parseDateSafe(parsed.sentDate) ?? new Date(),
      sentByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "LAB_DISPATCHED",
    entityType: "MicrobiologyResult",
    entityId: resultId,
    detail: `${existing.labType === "IN_HOUSE" ? "In-House" : "External"} lab — Lot ${existing.lot.lotNumber}${parsed.labName ? ` to ${parsed.labName}` : ""}`,
  });

  revalidatePath("/lab");
  revalidatePath(`/production/${updated.lotId}`);
}

const resultSchema = z.object({
  status: z.enum(["PENDING", "SENT_TO_LAB", "APPROVED", "FAILED_MINOR", "FAILED_SEVERE"]),
  notes: z.string().optional(),

  // Shared by both lab types -- both real certificates on file turned out to
  // have essentially the same client/sample header shape.
  certificateNumber: z.string().optional(),
  labName: z.string().optional(),
  clientName: z.string().optional(),
  clientAddress: z.string().optional(),
  attentionTo: z.string().optional(),
  sampleCode: z.string().optional(),
  sampleType: z.string().optional(),
  sampleSize: z.string().optional(),
  sampleCondition: z.string().optional(),
  sampleData: z.string().optional(),
  otherData: z.string().optional(),
  reportDate: z.string().optional(),
  recommendation: z.string().optional(),
  preparedBy: z.string().optional(),
  reviewedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  analysisStartDate: z.string().optional(),
  analysisEndDate: z.string().optional(),
  personInCharge: z.string().optional(),
  resultsSummary: z.string().optional(),

  // Older external residue/contaminant panel certificates that don't fit the
  // shared shape above -- left blank otherwise.
  sampleId: z.string().optional(),
  protocolNumber: z.string().optional(),
  samplingBagSerial: z.string().optional(),
  samplingPlace: z.string().optional(),
  methodName: z.string().optional(),

  rejectedQuantityTonnes: z.coerce.number().min(0).optional(),
  rejectionReason: z.string().optional(),
  correctiveAction: z.string().optional(),

  totalPlateCountCfuG: z.coerce.number().min(0).optional(),
});

const testLineSchema = z.object({
  testName: z.string().optional(),
  result: z.string().optional(),
  unit: z.string().optional(),
  measurementUncertainty: z.string().optional(),
  methodRef: z.string().optional(),
});

const FINAL_STATUSES = ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"] as const;

export async function updateLabResultAction(
  resultId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const raw = Object.fromEntries(
    Array.from(formData.entries())
      .filter(([k]) => k !== "certificateFile" && k !== "testLinesJson")
      .map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = resultSchema.parse(raw);

  // Above the graduated cfu/g tier system (see src/lib/cfuTier.ts) is an
  // automatic hard reject regardless of what status was manually picked --
  // this can't be silently overridden by choosing Approved despite an
  // out-of-range reading.
  const status =
    parsed.totalPlateCountCfuG != null && parsed.totalPlateCountCfuG >= CFU_REJECT_TIER.min
      ? "FAILED_SEVERE"
      : parsed.status;

  const existing = await prisma.microbiologyResult.findUnique({ where: { id: resultId }, include: { lot: true } });
  if (!existing) return;

  const file = formData.get("certificateFile");
  const hasNewFile = file instanceof File && file.size > 0;

  // A result can't be recorded as Approved/Failed with nothing to back it up
  // -- this is exactly the gap that let results sit "Approved" with no data
  // and no certificate on file.
  if ((FINAL_STATUSES as readonly string[]).includes(status)) {
    if (!hasNewFile && !existing.certificateFileName) {
      return "A certificate file must be attached before this result can be recorded as Approved or Failed.";
    }
    if (!parsed.certificateNumber?.trim()) {
      return "Certificate/lab result number is required before this result can be recorded as Approved or Failed.";
    }
    if (!parsed.sampleCode?.trim()) {
      return "Sample code is required before this result can be recorded as Approved or Failed.";
    }
    // The same lab-issued certificate number showing up on a different lot's
    // result is the clearest sign of a mixed-up or reused attachment -- catch
    // it here rather than trusting the file was the right one for this lot.
    const duplicate = await prisma.microbiologyResult.findFirst({
      where: { id: { not: resultId }, certificateNumber: { equals: parsed.certificateNumber.trim(), mode: "insensitive" } },
      include: { lot: true },
    });
    if (duplicate) {
      return `Certificate number "${parsed.certificateNumber}" is already recorded against Lot ${duplicate.lot.lotNumber} -- a lab result shouldn't be reused across different lots. Check this is the right certificate for Lot ${existing.lot.lotNumber}.`;
    }
  }

  const { analysisStartDate, analysisEndDate, reportDate, ...rest } = parsed;

  let rawLines: unknown = [];
  try {
    const raw2 = formData.get("testLinesJson");
    rawLines = raw2 ? JSON.parse(String(raw2)) : [];
  } catch {
    rawLines = [];
  }
  const testLines = z.array(testLineSchema).parse(rawLines).filter((l) => l.testName || l.result);

  let fileFields: { certificateFileName?: string; certificateFileOriginalName?: string } = {};
  if (hasNewFile) {
    const saved = await saveUploadedFile(file, "certificates");
    fileFields = { certificateFileName: saved.fileName, certificateFileOriginalName: saved.originalName };
  }

  const session = await auth();

  const isNewRejection =
    (status === "FAILED_MINOR" || status === "FAILED_SEVERE") &&
    existing.status !== "FAILED_MINOR" &&
    existing.status !== "FAILED_SEVERE";

  await prisma.$transaction(async (tx) => {
    await tx.microbiologyResult.update({
      where: { id: resultId },
      data: {
        ...rest,
        status,
        ...fileFields,
        receivedDate: new Date(),
        analysisStartDate: parseDateSafe(analysisStartDate),
        analysisEndDate: parseDateSafe(analysisEndDate),
        reportDate: parseDateSafe(reportDate),
        testLines: {
          deleteMany: {},
          create: testLines,
        },
      },
    });

    if (status === "FAILED_SEVERE") {
      const pallets = await tx.pallet.findMany({
        where: { lotId: existing.lotId, status: { in: ["IN_STORAGE", "DISCOUNT_OFFERED"] } },
      });
      for (const pallet of pallets) {
        await tx.pallet.update({ where: { id: pallet.id }, data: { status: "WASTE" } });
        await tx.waste.create({
          data: {
            palletId: pallet.id,
            quantity: pallet.weightTonnes,
            reason: "Microbiology failure (severe): " + (parsed.rejectionReason || parsed.notes || "see quality report"),
          },
        });
      }
    } else if (status === "FAILED_MINOR") {
      await tx.pallet.updateMany({
        where: { lotId: existing.lotId, status: "IN_STORAGE" },
        data: { status: "DISCOUNT_OFFERED" },
      });
    }
  });

  if (status === "APPROVED" || status === "FAILED_MINOR" || status === "FAILED_SEVERE") {
    await logActivity({
      actorId: session?.user.id,
      action: "LAB_RESULT_RECORDED",
      entityType: "MicrobiologyResult",
      entityId: resultId,
      detail: `${existing.labType === "IN_HOUSE" ? "In-House" : "External"} lab — Lot ${existing.lot.lotNumber}: ${status.replace(/_/g, " ")}${parsed.totalPlateCountCfuG != null ? ` (${parsed.totalPlateCountCfuG.toLocaleString()} cfu/g)` : ""}`,
    });
  }

  if (isNewRejection) {
    await raiseMicrobiologyRejectionAlert({
      lotId: existing.lotId,
      lotNumber: existing.lot.lotNumber,
      severity: status as "FAILED_MINOR" | "FAILED_SEVERE",
      rejectedQuantityTonnes: parsed.rejectedQuantityTonnes ?? null,
      rejectionReason: parsed.rejectionReason ?? null,
    });
  }

  // A lot's two lab results are independent, so re-check both together every
  // time either one changes -- this is what catches the case where the two
  // labs disagree (one Approved, one Failed), regardless of which one just
  // got updated or which order they came back in.
  const siblingResults = await prisma.microbiologyResult.findMany({ where: { lotId: existing.lotId } });
  if (isSplitResult(siblingResults)) {
    const approved = siblingResults.find((r) => r.status === "APPROVED");
    const failed = siblingResults.find((r) => r.status === "FAILED_MINOR" || r.status === "FAILED_SEVERE");
    const labLabel = (t?: string) => (t === "IN_HOUSE" ? "In-House" : "External");
    await raiseShiftOnHoldAlert({
      shiftId: existing.lot.shiftId,
      reason: `Split microbiology result on Lot ${existing.lot.lotNumber}: ${labLabel(approved?.labType)} lab Approved it, but ${labLabel(failed?.labType)} lab ${failed?.status === "FAILED_SEVERE" ? "Failed (Severe)" : "Failed (Minor)"}. Every lot from this shift is on hold pending further testing.`,
    });
  }

  revalidatePath("/lab");
  revalidatePath(`/production/${existing.lotId}`);
  revalidatePath("/storage");
  revalidatePath("/waste");
  revalidatePath("/alerts");
  return "ok";
}

const resolveHoldSchema = z.object({
  resolvedBy: z.string().min(1, "Your name is required."),
  resolutionNote: z.string().min(1, "A resolution note is required."),
});

export async function resolveShiftHoldAction(shiftId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = resolveHoldSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.shiftLog.update({
    where: { id: shiftId },
    data: {
      onHold: false,
      holdResolvedAt: new Date(),
      holdResolvedBy: parsed.data.resolvedBy,
      holdResolutionNote: parsed.data.resolutionNote,
    },
  });

  await prisma.alert.updateMany({
    where: { relatedEntityId: shiftId, type: "SHIFT_ON_HOLD", status: "UNREAD" },
    data: { status: "READ" },
  });

  revalidatePath("/lab");
  revalidatePath("/alerts");
  revalidatePath("/production");
  return "ok";
}
