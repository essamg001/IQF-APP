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

  // The palletId: null in this update's own where clause is the actual guard --
  // the plain check above only protects against a slot that was ALREADY
  // occupied when the page loaded, not one grabbed by someone else in the
  // moments since. If two submissions race for the same empty slot, only the
  // first update's where clause still matches; the second gets count: 0
  // instead of silently overwriting the first assignment.
  const claimed = await prisma.$transaction(async (tx) => {
    // Claim the target slot BEFORE vacating the old one -- if the claim
    // fails, the pallet must stay exactly where it already was rather than
    // ending up vacated from its old slot with no new one to show for it.
    const result = await tx.coldRoomSlot.updateMany({
      where: { id: parsed.data.slotId, palletId: null },
      data: { palletId: parsed.data.palletId },
    });
    if (result.count === 0) return false;
    await tx.coldRoomSlot.updateMany({
      where: { palletId: parsed.data.palletId, id: { not: parsed.data.slotId } },
      data: { palletId: null },
    });
    await tx.pallet.update({ where: { id: parsed.data.palletId }, data: { coldRoomId: slot.coldRoomId } });
    return true;
  });

  if (!claimed) return "Someone just took that slot — pick another.";

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

const pullAsideSchema = z.object({
  slotId: z.string().min(1),
  reason: z.string().optional(),
});

// Pulling a pallet out just to reach one behind it is NOT the same event as
// unassignSlotAction above -- that means "this pallet has left the room
// entirely" (coldRoomId cleared). A pull-aside pallet is still physically
// in the room, just not currently in a slot, and it owes a specific way
// back -- so this keeps Pallet.coldRoomId set and opens a PalletPullAside
// record instead of just freeing the slot silently.
export async function pullPalletAsideAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to pull a pallet aside.";

  const parsed = pullAsideSchema.safeParse({
    slotId: formData.get("slotId"),
    reason: formData.get("reason") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const slot = await prisma.coldRoomSlot.findUniqueOrThrow({ where: { id: parsed.data.slotId }, include: { pallet: true } });
  if (!slot.palletId) return "This slot is already empty.";

  const existing = await prisma.palletPullAside.findFirst({ where: { palletId: slot.palletId, resolvedAt: null } });
  if (existing) return "This pallet is already marked as pulled aside and awaiting re-shelve.";

  const name = session.user.name || session.user.email;

  await prisma.$transaction([
    prisma.coldRoomSlot.update({ where: { id: slot.id }, data: { palletId: null } }),
    prisma.palletPullAside.create({
      data: {
        palletId: slot.palletId,
        coldRoomId: slot.coldRoomId,
        round: slot.round,
        rack: slot.rack,
        reason: parsed.data.reason,
        pulledByName: name,
        pulledByUserId: session.user.id,
      },
    }),
  ]);

  await logActivity({
    actorId: session.user.id,
    action: "PALLET_PULLED_ASIDE",
    entityType: "Pallet",
    entityId: slot.palletId,
    detail: `${slot.pallet?.palletNumber ?? slot.palletId} pulled aside from Round ${slot.round} / Rack ${slot.rack} / Level ${slot.level}${parsed.data.reason ? ` — ${parsed.data.reason}` : ""}`,
  });

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${slot.palletId}`);
}

const reshelveSchema = z.object({
  pullAsideId: z.string().min(1),
  slotId: z.string().min(1),
});

export async function reshelvePalletAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to re-shelve a pallet.";

  const parsed = reshelveSchema.safeParse({
    pullAsideId: formData.get("pullAsideId"),
    slotId: formData.get("slotId"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const pullAside = await prisma.palletPullAside.findUniqueOrThrow({
    where: { id: parsed.data.pullAsideId },
    include: { pallet: true },
  });
  if (pullAside.resolvedAt) return "This pallet has already been re-shelved.";

  const slot = await prisma.coldRoomSlot.findUniqueOrThrow({ where: { id: parsed.data.slotId } });

  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.coldRoomSlot.updateMany({
      where: { id: parsed.data.slotId, palletId: null },
      data: { palletId: pullAside.palletId },
    });
    if (result.count === 0) return false;
    await tx.pallet.update({ where: { id: pullAside.palletId }, data: { coldRoomId: slot.coldRoomId } });
    await tx.palletPullAside.update({
      where: { id: pullAside.id },
      data: { resolvedAt: new Date(), resolvedSlotId: slot.id },
    });
    return true;
  });

  if (!claimed) return "Someone just took that slot — pick another.";

  await logActivity({
    actorId: session.user.id,
    action: "PALLET_RESHELVED",
    entityType: "Pallet",
    entityId: pullAside.palletId,
    detail: `${pullAside.pallet.palletNumber} re-shelved to Round ${slot.round} / Rack ${slot.rack} / Level ${slot.level} (pulled from Round ${pullAside.round} / Rack ${pullAside.rack})`,
  });

  revalidatePath(`/storage/map/${slot.coldRoomId}`);
  revalidatePath("/storage/map");
  revalidatePath(`/storage/${pullAside.palletId}`);
}
