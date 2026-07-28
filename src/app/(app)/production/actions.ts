"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateLotNumber } from "@/lib/lotNumber";
import { parseLocalDateOnly } from "@/lib/dates";
import { z } from "zod";

const lotSchema = z.object({
  farmCode: z.string().min(1),
  date: z.string().min(1),
  factoryId: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  fieldName: z.string().min(1),
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
    farmCode: formData.get("farmCode"),
    date: formData.get("date"),
    factoryId: formData.get("factoryId"),
    shiftType: formData.get("shiftType"),
    fieldName: formData.get("fieldName"),
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

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read — please re-enter it.";

  const factory = await prisma.factory.findUnique({ where: { id: parsed.data.factoryId } });
  if (!factory) return "Factory not found.";
  if (!factory.code) return `${factory.name} has no IQF unit code set — add one in Settings first.`;

  const shift = await prisma.shiftLog.findFirst({
    where: { factoryId: parsed.data.factoryId, shiftType: parsed.data.shiftType, date },
  });
  if (!shift) {
    const shiftLabel = parsed.data.shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)";
    return `No shift logged for ${factory.name} — ${shiftLabel} on ${parsed.data.date}. Log the shift first.`;
  }

  const farmCode = parsed.data.farmCode.trim().toUpperCase();
  const lotNumber = generateLotNumber({
    farmCode,
    factoryCode: factory.code,
    date,
    shiftType: parsed.data.shiftType,
  });

  const existing = await prisma.productionLot.findUnique({ where: { lotNumber } });
  if (existing) {
    return `Lot ${lotNumber} already exists — this farm/facility/day/shift combination has already been logged.`;
  }

  // Field entry is free text (not a fixed list) -- match an existing field by
  // name or create one on the fly, so production isn't blocked on someone
  // pre-registering the field in Settings first.
  const fieldName = parsed.data.fieldName.trim();
  const field = await prisma.field.upsert({
    where: { name: fieldName },
    update: {},
    create: { name: fieldName },
  });

  const { cartonLogo, cartonSize, variety } = parsed.data;

  await prisma.productionLot.create({
    data: {
      lotNumber,
      farmCode,
      shiftId: shift.id,
      factoryId: factory.id,
      fieldId: field.id,
      grade: parsed.data.grade,
      format: parsed.data.format,
      isEndOfDayGradeB: parsed.data.isEndOfDayGradeB,
      microbiologyResults: { create: [{ labType: "IN_HOUSE" }, { labType: "EXTERNAL" }] },
      pallets: {
        create: Array.from({ length: parsed.data.palletCount }, (_, i) => ({
          palletNumber: `${lotNumber}-P${i + 1}`,
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
