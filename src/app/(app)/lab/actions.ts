"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/files";
import { parseDateSafe } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const sendSchema = z.object({
  labName: z.string().optional(),
  trackingRef: z.string().optional(),
  sentDate: z.string().optional(),
});

export async function markSentToLabAction(lotId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = sendSchema.parse(raw);
  const session = await auth();

  await prisma.microbiologyResult.update({
    where: { lotId },
    data: {
      status: "SENT_TO_LAB",
      labName: parsed.labName,
      trackingRef: parsed.trackingRef,
      sentDate: parseDateSafe(parsed.sentDate) ?? new Date(),
      sentByUserId: session?.user.id,
    },
  });

  revalidatePath("/lab");
  revalidatePath(`/production/${lotId}`);
}

const resultSchema = z.object({
  status: z.enum(["PENDING", "SENT_TO_LAB", "APPROVED", "FAILED_MINOR", "FAILED_SEVERE"]),
  notes: z.string().optional(),
  certificateNumber: z.string().optional(),
  labName: z.string().optional(),
  sampleId: z.string().optional(),
  protocolNumber: z.string().optional(),
  samplingBagSerial: z.string().optional(),
  samplingPlace: z.string().optional(),
  analysisStartDate: z.string().optional(),
  analysisEndDate: z.string().optional(),
  methodName: z.string().optional(),
  personInCharge: z.string().optional(),
  resultsSummary: z.string().optional(),
});

export async function updateLabResultAction(lotId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries())
      .filter(([k]) => k !== "certificateFile")
      .map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = resultSchema.parse(raw);
  const { analysisStartDate, analysisEndDate, ...rest } = parsed;

  const file = formData.get("certificateFile");
  let fileFields: { certificateFileName?: string; certificateFileOriginalName?: string } = {};
  if (file instanceof File && file.size > 0) {
    const saved = await saveUploadedFile(file, "certificates");
    fileFields = { certificateFileName: saved.fileName, certificateFileOriginalName: saved.originalName };
  }

  await prisma.$transaction(async (tx) => {
    await tx.microbiologyResult.update({
      where: { lotId },
      data: {
        ...rest,
        ...fileFields,
        receivedDate: new Date(),
        analysisStartDate: parseDateSafe(analysisStartDate),
        analysisEndDate: parseDateSafe(analysisEndDate),
      },
    });

    if (parsed.status === "FAILED_SEVERE") {
      const pallets = await tx.pallet.findMany({
        where: { lotId, status: { in: ["IN_STORAGE", "DISCOUNT_OFFERED"] } },
      });
      for (const pallet of pallets) {
        await tx.pallet.update({ where: { id: pallet.id }, data: { status: "WASTE" } });
        await tx.waste.create({
          data: {
            palletId: pallet.id,
            quantity: pallet.weightTonnes,
            reason: "Microbiology failure (severe): " + (parsed.notes || "see quality report"),
          },
        });
      }
    } else if (parsed.status === "FAILED_MINOR") {
      await tx.pallet.updateMany({
        where: { lotId, status: "IN_STORAGE" },
        data: { status: "DISCOUNT_OFFERED" },
      });
    }
  });

  revalidatePath("/lab");
  revalidatePath(`/production/${lotId}`);
  revalidatePath("/storage");
  revalidatePath("/waste");
}
