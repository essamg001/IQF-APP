"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const assignSchema = z.object({
  slotId: z.string().min(1),
  palletId: z.string().min(1),
});

export async function assignPalletToSlotAction(_prevState: string | undefined, formData: FormData) {
  const parsed = assignSchema.safeParse({
    slotId: formData.get("slotId"),
    palletId: formData.get("palletId"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const slot = await prisma.coldRoomSlot.findUnique({ where: { id: parsed.data.slotId } });
  if (!slot) return "Slot not found.";
  if (slot.palletId) return "This slot is already occupied — unassign it first.";

  await prisma.$transaction([
    // A pallet can only occupy one slot -- moving it here vacates wherever it was.
    prisma.coldRoomSlot.updateMany({ where: { palletId: parsed.data.palletId }, data: { palletId: null } }),
    prisma.coldRoomSlot.update({ where: { id: parsed.data.slotId }, data: { palletId: parsed.data.palletId } }),
    prisma.pallet.update({ where: { id: parsed.data.palletId }, data: { coldRoomId: slot.coldRoomId } }),
  ]);

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${parsed.data.palletId}`);
}

export async function unassignSlotAction(slotId: string) {
  const slot = await prisma.coldRoomSlot.findUniqueOrThrow({ where: { id: slotId } });
  if (!slot.palletId) return;

  await prisma.coldRoomSlot.update({ where: { id: slotId }, data: { palletId: null } });

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${slot.palletId}`);
}
