"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";

const packedPalletSchema = z.object({
  lotNumber: z.string().min(1),
  coldRoomId: z.string().optional(),
  palletNumber: z.string().min(1),
  cartonLogo: z.string().optional(),
  cartonSize: z.string().optional(),
  variety: z.string().optional(),
  isMixedVariety: z.boolean(),
  parcelStatus: z.enum(["FULL", "PARTIAL"]),
  totalCartons: z.coerce.number().int().positive().optional(),
  weightTonnes: z.coerce.number().positive(),
  clientSpecNote: z.string().optional(),
  qualityGrade: z.enum(["A", "B"]).optional(),
  packingDate: z.string().optional(),
  packingLocation: z.string().optional(),
  packingSupervisor: z.string().optional(),
  palletizationStart: z.string().optional(),
  palletizationEnd: z.string().optional(),
  fruitDiameterCalibrated: z.boolean(),
});

export async function createPackedPalletAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = packedPalletSchema.safeParse({
    ...raw,
    isMixedVariety: formData.get("isMixedVariety") === "on",
    fruitDiameterCalibrated: formData.get("fruitDiameterCalibrated") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const lot = await prisma.productionLot.findUnique({ where: { lotNumber: parsed.data.lotNumber.trim() } });
  if (!lot) return `Lot ${parsed.data.lotNumber} not found — check the number and try again.`;

  // The pallet number is a physical asset ID, reused across many lots over
  // its lifetime -- so "does this number already exist" is scoped to this
  // lot specifically, not the number alone. It's usually already sampled at
  // Post-Freeze Inspection (the first stage a pallet gets tied to a lot);
  // this form completes that same record with packing details rather than
  // creating a duplicate. A pallet number never before seen on this lot
  // still falls through to creating a fresh row (e.g. Post-Freeze Inspection
  // was skipped for it).
  const existing = await prisma.pallet.findUnique({
    where: { palletNumber_lotId: { palletNumber: parsed.data.palletNumber, lotId: lot.id } },
  });

  const { lotNumber, packingDate, palletizationStart, palletizationEnd, parcelStatus, ...data } = parsed.data;

  const packingData = {
    ...data,
    lotId: lot.id,
    fullPallet: parcelStatus === "FULL",
    packingDate: parseDateSafe(packingDate),
    palletizationStart: parseDateSafe(palletizationStart),
    palletizationEnd: parseDateSafe(palletizationEnd),
  };

  const saved = existing
    ? await prisma.pallet.update({ where: { id: existing.id }, data: packingData })
    : await prisma.pallet.create({ data: packingData });

  revalidatePath("/final-product-entry");
  revalidatePath("/storage");
  return `ok:${saved.id}`;
}
