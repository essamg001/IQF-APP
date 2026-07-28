"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { parseDateSafe } from "@/lib/dates";
import { raiseMicrobiologyRejectionAlert, raiseShiftOnHoldAlert } from "@/lib/alerts";
import { isSplitResult } from "@/lib/microbiology";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sendSchema = z.object({
  labName: z.string().optional(),
  trackingRef: z.string().optional(),
  sentDate: z.string().optional(),
});

export async function markSentToLabAction(resultId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = sendSchema.parse(raw);
  const session = await auth();

  const updated = await prisma.microbiologyResult.update({
    where: { id: resultId },
    data: {
      status: "SENT_TO_LAB",
      labName: parsed.labName,
      trackingRef: parsed.trackingRef,
      sentDate: parseDateSafe(parsed.sentDate) ?? new Date(),
      sentByUserId: session?.user.id,
    },
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
});

const testLineSchema = z.object({
  testName: z.string().optional(),
  result: z.string().optional(),
  unit: z.string().optional(),
  measurementUncertainty: z.string().optional(),
  methodRef: z.string().optional(),
});

export async function updateLabResultAction(resultId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries())
      .filter(([k]) => k !== "certificateFile" && k !== "testLinesJson")
      .map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = resultSchema.parse(raw);
  const { analysisStartDate, analysisEndDate, reportDate, ...rest } = parsed;

  let rawLines: unknown = [];
  try {
    const raw2 = formData.get("testLinesJson");
    rawLines = raw2 ? JSON.parse(String(raw2)) : [];
  } catch {
    rawLines = [];
  }
  const testLines = z.array(testLineSchema).parse(rawLines).filter((l) => l.testName || l.result);

  const file = formData.get("certificateFile");
  let fileFields: { certificateFileName?: string; certificateFileOriginalName?: string } = {};
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadedFile(file, "certificates");
    fileFields = { certificateFileName: saved.fileName, certificateFileOriginalName: saved.originalName };
  }

  const existing = await prisma.microbiologyResult.findUnique({ where: { id: resultId }, include: { lot: true } });
  if (!existing) return;

  const isNewRejection =
    (parsed.status === "FAILED_MINOR" || parsed.status === "FAILED_SEVERE") &&
    existing.status !== "FAILED_MINOR" &&
    existing.status !== "FAILED_SEVERE";

  await prisma.$transaction(async (tx) => {
    await tx.microbiologyResult.update({
      where: { id: resultId },
      data: {
        ...rest,
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

    if (parsed.status === "FAILED_SEVERE") {
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
    } else if (parsed.status === "FAILED_MINOR") {
      await tx.pallet.updateMany({
        where: { lotId: existing.lotId, status: "IN_STORAGE" },
        data: { status: "DISCOUNT_OFFERED" },
      });
    }
  });

  if (isNewRejection) {
    await raiseMicrobiologyRejectionAlert({
      lotId: existing.lotId,
      lotNumber: existing.lot.lotNumber,
      severity: parsed.status as "FAILED_MINOR" | "FAILED_SEVERE",
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
