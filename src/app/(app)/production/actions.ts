"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const lotSchema = z.object({
  lotNumber: z.string().min(1),
  shiftId: z.string().min(1),
  fieldId: z.string().min(1),
  grade: z.enum(["A", "B"]),
  format: z.enum(["WHOLE", "SLICED", "DICED"]),
  isEndOfDayGradeB: z.boolean(),
  palletCount: z.coerce.number().int().positive().max(500),
  coldRoomId: z.string().min(1),
  cartonLogo: z.string().optional(),
  cartonSize: z.string().optional(),
  variety: z.string().optional(),
});

export async function createLotAction(_prevState: string | undefined, formData: FormData) {
  const parsed = lotSchema.safeParse({
    lotNumber: formData.get("lotNumber"),
    shiftId: formData.get("shiftId"),
    fieldId: formData.get("fieldId"),
    grade: formData.get("grade"),
    format: formData.get("format"),
    isEndOfDayGradeB: formData.get("isEndOfDayGradeB") === "on",
    palletCount: formData.get("palletCount"),
    coldRoomId: formData.get("coldRoomId"),
    cartonLogo: formData.get("cartonLogo") || undefined,
    cartonSize: formData.get("cartonSize") || undefined,
    variety: formData.get("variety") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const shift = await prisma.shiftLog.findUnique({ where: { id: parsed.data.shiftId } });
  if (!shift) return "Shift not found.";

  const existing = await prisma.productionLot.findUnique({ where: { lotNumber: parsed.data.lotNumber } });
  if (existing) return "A lot with this number already exists.";

  const { cartonLogo, cartonSize, variety } = parsed.data;

  await prisma.productionLot.create({
    data: {
      lotNumber: parsed.data.lotNumber,
      shiftId: parsed.data.shiftId,
      factoryId: shift.factoryId,
      fieldId: parsed.data.fieldId,
      grade: parsed.data.grade,
      format: parsed.data.format,
      isEndOfDayGradeB: parsed.data.isEndOfDayGradeB,
      microbiologyResult: { create: {} },
      pallets: {
        create: Array.from({ length: parsed.data.palletCount }, (_, i) => ({
          palletNumber: `${parsed.data.lotNumber}-P${i + 1}`,
          coldRoomId: parsed.data.coldRoomId,
          cartonLogo,
          cartonSize,
          variety,
        })),
      },
    },
  });

  revalidatePath("/production");
  revalidatePath("/storage");
  redirect("/production");
}

export async function markWasteAction(palletId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!reason) return;

  await prisma.$transaction(async (tx) => {
    await tx.pallet.update({ where: { id: palletId }, data: { status: "WASTE" } });
    await tx.waste.create({ data: { palletId, reason, quantity } });
  });

  revalidatePath("/storage");
  revalidatePath("/waste");
  revalidatePath(`/storage/${palletId}`);
}
