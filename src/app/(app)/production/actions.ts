"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateLotNumber } from "@/lib/lotNumber";
import { parseLocalDateOnly } from "@/lib/dates";
import { logActivity } from "@/lib/activityLog";
import { findOrCreateShift } from "@/lib/shifts";
import { raiseShiftMissingPostDecapLinkAlert } from "@/lib/alerts";
import { z } from "zod";

const lotSchema = z.object({
  farmCode: z.string().min(1),
  date: z.string().min(1),
  factoryId: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  fieldNames: z.array(z.string().min(1)).min(1, "At least one supplying field is required."),
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
    fieldNames: formData.getAll("fieldNames").map(String).filter((s) => s.trim().length > 0),
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

  // Nobody may have opened this shift by hand yet -- find-or-create it here
  // rather than blocking the lot on a trip to Log Shift, using the same
  // cleaning-sign-off gate that page enforces (see findOrCreateShift).
  const shiftResult = await findOrCreateShift(parsed.data.factoryId, parsed.data.shiftType, date);
  if (shiftResult.shift === null) return shiftResult.blockReason;
  const shift = shiftResult.shift;
  revalidatePath("/shifts");

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

  // Fields that had an accepted Post-Decap Quality check tied to this exact
  // date+shift (decap is factory-agnostic, so this doesn't filter by factory),
  // for telling apart automatically-confirmed suppliers from ones the
  // grower/user typed in manually (the "add another field" escape hatch).
  const confirmedChecks = await prisma.qualityCheck.findMany({
    where: {
      checkpoint: "POST_DECAP",
      decision: "ACCEPTED",
      decapShift: { date, shiftType: parsed.data.shiftType },
      fieldId: { not: null },
    },
    select: { fieldId: true },
  });
  const confirmedFieldIds = new Set(confirmedChecks.map((c) => c.fieldId!));

  // Field entry is free text (not a fixed list) -- match an existing field by
  // name or create one on the fly, so production isn't blocked on someone
  // pre-registering the field in Settings first. Matching case-insensitively
  // means a casing typo like "Mafa 4" vs the real "MAFA 4" reuses the real
  // field instead of silently forking off a duplicate.
  const seenFieldIds = new Set<string>();
  let anyConfirmed = false;
  for (const rawName of parsed.data.fieldNames) {
    const fieldName = rawName.trim();
    const existingField = await prisma.field.findFirst({
      where: { name: { equals: fieldName, mode: "insensitive" } },
    });
    const field = existingField ?? (await prisma.field.create({ data: { name: fieldName } }));
    if (confirmedFieldIds.has(field.id)) anyConfirmed = true;
    seenFieldIds.add(field.id);
  }

  const lot = await prisma.productionLot.create({
    data: {
      lotNumber,
      farmCode,
      shiftId: shift.id,
      factoryId: factory.id,
      fields: { create: [...seenFieldIds].map((fieldId) => ({ fieldId })) },
      grade: parsed.data.grade,
      format: parsed.data.format,
      isEndOfDayGradeB: parsed.data.isEndOfDayGradeB,
      microbiologyResults: { create: [{ labType: "IN_HOUSE" }, { labType: "EXTERNAL" }] },
      mrlResult: { create: {} },
    },
  });

  if (!anyConfirmed) {
    await raiseShiftMissingPostDecapLinkAlert({ lotId: lot.id, lotNumber: lot.lotNumber });
  }

  revalidatePath("/production");
  redirect("/production");
}

export async function markWasteAction(palletId: string, formData: FormData) {
  const reason = String(formData.get("reason") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  if (!reason) return;

  // Only rendered for users who can see cost data (canSeeFinancials) -- a
  // user without that access simply never sends this field, so it stays
  // null rather than needing its own server-side permission check.
  const costUsdRaw = formData.get("costUsd");
  const costUsd = costUsdRaw && String(costUsdRaw).trim() !== "" ? Number(costUsdRaw) : undefined;

  const session = await auth();

  await prisma.$transaction(async (tx) => {
    // A wasted pallet can no longer fulfil whatever order it was allocated
    // to -- releasing the allocation here (rather than leaving orderId/
    // clientId set) is what makes the order's "remaining to allocate" count,
    // Available to Sell's committed figure, and the allocated-pallets
    // display all correctly reflect that this pallet no longer counts.
    await tx.pallet.update({ where: { id: palletId }, data: { status: "WASTE", orderId: null, clientId: null } });
    await tx.waste.create({ data: { palletId, reason, quantity, costUsd } });
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
  revalidatePath("/logistics");
}
