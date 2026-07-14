"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const arrivalCheckSchema = z
  .object({
    appliesToWholeDelivery: z.boolean(),
    decision: z.enum(["ACCEPTED", "REJECTED"]),
    sampleNo: z.string().optional(),
    rawMaterialSource: z.string().optional(),
    farmCode: z.string().optional(),
    transportVehicleNo: z.string().optional(),
    receiptNoteNo: z.string().optional(),
    numberOfBoxesReceived: z.coerce.number().int().optional(),
    crateWeightKg: z.coerce.number().optional(),
    sizeCaliber: z.string().optional(),
    brix: z.coerce.number().min(0).max(30).optional(),
    fruitColorPct: z.coerce.number().min(0).max(100).optional(),
    internalQualityPct: z.coerce.number().min(0).max(100).optional(),
    mouldPct: z.coerce.number().min(0).max(100).optional(),
    skinDamagePct: z.coerce.number().min(0).max(100).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.appliesToWholeDelivery || data.sampleNo, {
    message: "Sample/pallet reference is required unless this is a whole-delivery rejection.",
    path: ["sampleNo"],
  })
  .refine((data) => data.appliesToWholeDelivery || data.brix !== undefined, {
    message: "Brix is required unless this is a whole-delivery rejection.",
    path: ["brix"],
  });

export async function createArrivalCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = arrivalCheckSchema.safeParse({
    ...raw,
    appliesToWholeDelivery: formData.get("appliesToWholeDelivery") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const session = await auth();
  const { ...data } = parsed.data;

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "RAW_MATERIAL",
      lotId: null,
      decision: data.decision,
      appliesToWholeDelivery: data.appliesToWholeDelivery,
      sampleNo: data.sampleNo,
      rawMaterialSource: data.rawMaterialSource,
      farmCode: data.farmCode,
      transportVehicleNo: data.transportVehicleNo,
      receiptNoteNo: data.receiptNoteNo,
      numberOfBoxesReceived: data.numberOfBoxesReceived,
      crateWeightKg: data.crateWeightKg,
      sizeCaliber: data.sizeCaliber,
      brix: data.brix ?? 0,
      fruitColorPct: data.fruitColorPct ?? 0,
      internalQualityPct: data.internalQualityPct ?? 0,
      mouldPct: data.mouldPct ?? 0,
      skinDamagePct: data.skinDamagePct ?? 0,
      notes: data.notes,
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/arrival-inspection");
  return `ok:${created.id}`;
}
