"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const assignSchema = z.object({
  slotId: z.string().min(1),
  palletId: z.string().min(1),
});

export async function assignPalletToSlotAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to assign a pallet to a slot.";

  const parsed = assignSchema.safeParse({
    slotId: formData.get("slotId"),
    palletId: formData.get("palletId"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const slot = await prisma.coldRoomSlot.findUnique({ where: { id: parsed.data.slotId } });
  if (!slot) return "Slot not found.";
  if (slot.palletId) return "This slot is already occupied — unassign it first.";

  const pallet = await prisma.pallet.findUniqueOrThrow({ where: { id: parsed.data.palletId } });

  await prisma.$transaction([
    // A pallet can only occupy one slot -- moving it here vacates wherever it was.
    prisma.coldRoomSlot.updateMany({ where: { palletId: parsed.data.palletId }, data: { palletId: null } }),
    prisma.coldRoomSlot.update({ where: { id: parsed.data.slotId }, data: { palletId: parsed.data.palletId } }),
    prisma.pallet.update({ where: { id: parsed.data.palletId }, data: { coldRoomId: slot.coldRoomId } }),
  ]);

  await logActivity({
    actorId: session.user.id,
    action: "PALLET_SLOT_ASSIGNED",
    entityType: "Pallet",
    entityId: parsed.data.palletId,
    detail: `${pallet.palletNumber} → Round ${slot.round} / Rack ${slot.rack} / Level ${slot.level}`,
  });

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${parsed.data.palletId}`);
}

export async function unassignSlotAction(slotId: string) {
  const session = await auth();
  if (!session?.user) return;

  const slot = await prisma.coldRoomSlot.findUniqueOrThrow({ where: { id: slotId }, include: { pallet: true } });
  if (!slot.palletId) return;

  await prisma.$transaction([
    prisma.coldRoomSlot.update({ where: { id: slotId }, data: { palletId: null } }),
    // Otherwise the pallet keeps pointing at a cold room it no longer has a
    // physical position in (e.g. the pallet detail page's "Cold room" row).
    prisma.pallet.update({ where: { id: slot.palletId }, data: { coldRoomId: null } }),
  ]);

  await logActivity({
    actorId: session.user.id,
    action: "PALLET_SLOT_UNASSIGNED",
    entityType: "Pallet",
    entityId: slot.palletId,
    detail: `${slot.pallet?.palletNumber ?? slot.palletId} vacated Round ${slot.round} / Rack ${slot.rack} / Level ${slot.level}`,
  });

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${slot.palletId}`);
}
