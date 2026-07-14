"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const microSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "FAILED_MINOR", "FAILED_SEVERE"]),
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

export async function updateMicrobiologyAction(lotId: string, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = microSchema.parse(raw);
  const { analysisStartDate, analysisEndDate, ...rest } = parsed;

  await prisma.$transaction(async (tx) => {
    await tx.microbiologyResult.update({
      where: { lotId },
      data: {
        ...rest,
        receivedDate: new Date(),
        analysisStartDate: analysisStartDate ? new Date(analysisStartDate) : undefined,
        analysisEndDate: analysisEndDate ? new Date(analysisEndDate) : undefined,
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

  revalidatePath(`/production/${lotId}`);
  revalidatePath("/production");
  revalidatePath("/storage");
  revalidatePath("/waste");
}
