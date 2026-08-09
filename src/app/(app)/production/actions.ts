"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateLotNumber } from "@/lib/lotNumber";
import { parseLocalDateOnly } from "@/lib/dates";
import { logActivity } from "@/lib/activityLog";
import { canSeeCosting } from "@/lib/roles";
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
  // pre-registering the field in Settings first. Matching case-insensitively
  // (rather than the exact-match upsert this used to be) means a casing typo
  // like "Mafa 4" vs the real "MAFA 4" reuses the real field instead of
  // silently forking off a duplicate that fragments its defect-rate history.
  const fieldName = parsed.data.fieldName.trim();
  const existingField = await prisma.field.findFirst({ where: { name: { equals: fieldName, mode: "insensitive" } } });
  const field = existingField ?? (await prisma.field.create({ data: { name: fieldName } }));

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
    },
  });

  revalidatePath("/production");
  redirect("/production");
}

export async function markWasteAction(palletId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!reason) return;

  const session = await auth();
  const valueUsdRaw = formData.get("valueUsd");
  const valueUsd = canSeeCosting(session?.user) && valueUsdRaw ? Number(valueUsdRaw) : undefined;

  await prisma.$transaction(async (tx) => {
    // A wasted pallet can no longer fulfil whatever order it was allocated
    // to -- releasing the allocation here (rather than leaving orderId/
    // clientId set) is what makes the order's "remaining to allocate" count,
    // Available to Sell's committed figure, and the allocated-pallets
    // display all correctly reflect that this pallet no longer counts.
    await tx.pallet.update({ where: { id: palletId }, data: { status: "WASTE", orderId: null, clientId: null } });
    await tx.waste.create({ data: { palletId, reason, quantity, valueUsd } });
  });

  await logActivity({
    actorId: session?.user.id,
    action: "PALLET_MARKED_WASTE",
    entityType: "Pallet",
    entityId: palletId,
    detail: `${quantity}t — ${reason}`,
  });

  revalidatePath("/storage");
  revalidatePath("/waste");
  revalidatePath(`/storage/${palletId}`);
  revalidatePath("/orders");
  revalidatePath("/available-to-sell");
  revalidatePath("/load-out");
}
