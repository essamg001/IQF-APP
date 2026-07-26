"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";

const checkSchema = z.object({
  lotNumber: z.string().min(1),
  palletNumber: z.string().optional(),
  checkpoint: z.enum(["RAW_MATERIAL", "POST_PACKAGING"]),
  complianceLevel: z.enum(["GLOBALGAP", "SPRING", "LEAF", "OTHER"]).optional(),
  complianceOther: z.string().optional(),
  shiftNumber: z.string().optional(),

  brix: z.coerce.number().min(0).max(30),
  fruitColorPct: z.coerce.number().min(0).max(100).default(0),
  internalQualityPct: z.coerce.number().min(0).max(100).default(0),
  acidityPh: z.coerce.number().optional(),
  productTemperatureC: z.coerce.number().optional(),
  varietyName: z.string().optional(),
  sampleCollectionTime: z.string().optional(),
  sampleWeightKg: z.coerce.number().optional(),

  sampleNo: z.string().optional(),
  rawMaterialSource: z.string().optional(),
  farmCode: z.string().optional(),
  transportVehicleNo: z.string().optional(),
  receiptNoteNo: z.string().optional(),
  numberOfBoxesReceived: z.coerce.number().int().optional(),
  crateWeightKg: z.coerce.number().optional(),
  sizeCaliber: z.string().optional(),

  clientName: z.string().optional(),
  operationDate: z.string().optional(),
  expiryDate: z.string().optional(),
  fullPallet: z.boolean().optional(),
  cartonWeightKg: z.coerce.number().optional(),
  packageClosureOk: z.boolean().optional(),
  dataLabelReviewOk: z.boolean().optional(),
  fruitDiameterUncalibrated: z.string().optional(),
  fruitDiameterCalibratedSmall: z.string().optional(),
  fruitDiameterCalibratedMedium: z.string().optional(),
  fruitDiameterCalibratedLarge: z.string().optional(),
  foreignOdor: z.string().optional(),
  foreignTaste: z.string().optional(),
  overmaturePct: z.coerce.number().optional(),

  mouldPct: z.coerce.number().min(0).max(100).default(0),
  skinDamagePct: z.coerce.number().min(0).max(100).default(0),
  firmnessScore: z.coerce.number().optional(),
});

export async function createQualityCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = checkSchema.safeParse({
    ...raw,
    fullPallet: formData.get("fullPallet") === "on",
    packageClosureOk: formData.get("packageClosureOk") === "on",
    dataLabelReviewOk: formData.get("dataLabelReviewOk") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const lot = await prisma.productionLot.findUnique({ where: { lotNumber: parsed.data.lotNumber.trim() } });
  if (!lot) return `Lot ${parsed.data.lotNumber} not found — check the number and try again.`;

  let palletId: string | undefined;
  if (parsed.data.palletNumber) {
    const pallet = await prisma.pallet.findUnique({ where: { palletNumber: parsed.data.palletNumber.trim() } });
    if (!pallet) return `Pallet ${parsed.data.palletNumber} not found — check the number and try again.`;
    palletId = pallet.id;
  }

  const session = await auth();
  const { lotNumber, palletNumber, operationDate, expiryDate, sampleCollectionTime, ...rest } = parsed.data;

  await prisma.qualityCheck.create({
    data: {
      ...rest,
      lotId: lot.id,
      palletId,
      operationDate: parseDateSafe(operationDate),
      expiryDate: parseDateSafe(expiryDate),
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/quality");
  redirect("/quality");
}
