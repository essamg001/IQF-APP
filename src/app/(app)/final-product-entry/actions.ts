"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const packedPalletSchema = z.object({
  lotId: z.string().min(1),
  coldRoomId: z.string().optional(),
  palletNumber: z.string().min(1),
  cartonLogo: z.string().optional(),
  cartonSize: z.string().optional(),
  variety: z.string().optional(),
  isMixedVariety: z.boolean(),
  parcelStatus: z.enum(["FULL", "PARTIAL"]),
  totalCartons: z.coerce.number().int().positive().optional(),
  traceabilityCode: z.string().optional(),
  clientSpecNote: z.string().optional(),
  packingDate: z.string().optional(),
  packingLocation: z.string().optional(),
  packingSupervisor: z.string().optional(),
  palletizationStart: z.string().optional(),
  palletizationEnd: z.string().optional(),
});

export async function createPackedPalletAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = packedPalletSchema.safeParse({
    ...raw,
    isMixedVariety: formData.get("isMixedVariety") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.pallet.findUnique({ where: { palletNumber: parsed.data.palletNumber } });
  if (existing) return `Pallet ${parsed.data.palletNumber} already exists.`;

  const { packingDate, palletizationStart, palletizationEnd, parcelStatus, ...data } = parsed.data;

  const created = await prisma.pallet.create({
    data: {
      ...data,
      fullPallet: parcelStatus === "FULL",
      packingDate: packingDate ? new Date(packingDate) : undefined,
      palletizationStart: palletizationStart ? new Date(palletizationStart) : undefined,
      palletizationEnd: palletizationEnd ? new Date(palletizationEnd) : undefined,
    },
  });

  revalidatePath("/final-product-entry");
  revalidatePath("/storage");
  return `ok:${created.id}`;
}
