"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { suggestAllocation } from "@/lib/allocation";
import { ORDER_STAGE_SEQUENCE, normalizedStageIndex } from "@/lib/orderLifecycle";
import { logActivity } from "@/lib/activityLog";
import { canSeeFinancials } from "@/lib/roles";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const PALLET_WEIGHT_TONNES = FULL_PALLET_WEIGHT_TONNES;

const orderSchema = z.object({
  poNumber: z.string().optional(),
  clientId: z.string().min(1),
  grade: z.enum(["A", "B"]),
  format: z.enum(["WHOLE", "SLICED", "DICED"]),
  quantityTonnes: z.coerce.number().positive(),
  valueUsd: z.coerce.number().nonnegative().optional(),
  orderDate: z.string().min(1),
  shipDate: z.string().optional(),
});

async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.order.count({ where: { orderNumber: { startsWith: `ORD-${year}-` } } });
  for (let i = count + 1; ; i++) {
    const candidate = `ORD-${year}-${String(i).padStart(4, "0")}`;
    const existing = await prisma.order.findUnique({ where: { orderNumber: candidate } });
    if (!existing) return candidate;
  }
}

export async function createOrderAction(_prevState: string | undefined, formData: FormData) {
  const parsed = orderSchema.safeParse({
    poNumber: formData.get("poNumber") || undefined,
    clientId: formData.get("clientId"),
    grade: formData.get("grade"),
    format: formData.get("format"),
    quantityTonnes: formData.get("quantityTonnes"),
    valueUsd: formData.get("valueUsd") || undefined,
    orderDate: formData.get("orderDate"),
    shipDate: formData.get("shipDate") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { quantityTonnes, valueUsd, shipDate, ...rest } = parsed.data;
  // Pallets are the actual allocatable unit in storage, so the tonnage the
  // client agrees to gets converted to whole pallets at 1t each.
  const quantityPallets = Math.max(1, Math.round(quantityTonnes / PALLET_WEIGHT_TONNES));
  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      ...rest,
      orderNumber,
      quantityPallets,
      valueUsd: valueUsd ?? 0,
      orderDate: new Date(rest.orderDate),
      shipDate: shipDate ? new Date(shipDate) : undefined,
    },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    detail: `${order.orderNumber} — Grade ${order.grade} ${order.format}, ${quantityTonnes}t`,
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderQuantityAction(orderId: string, formData: FormData) {
  const quantityTonnes = z.coerce.number().positive().parse(formData.get("quantityTonnes"));

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { _count: { select: { pallets: true } } } });
  // Once any pallet has been allocated, "Allocate pallets" has already used
  // the old target to pick real inventory -- changing it after the fact
  // would desync the order from what's actually been committed to it.
  if (order._count.pallets > 0) return;

  const quantityPallets = Math.max(1, Math.round(quantityTonnes / PALLET_WEIGHT_TONNES));

  await prisma.order.update({ where: { id: orderId }, data: { quantityPallets } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_QUANTITY_UPDATED",
    entityType: "Order",
    entityId: orderId,
    detail: `${order.quantityPallets} → ${quantityPallets} pallets`,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function updateOrderValueAction(orderId: string, formData: FormData) {
  const session = await auth();
  if (!canSeeFinancials(session?.user)) return;

  const valueUsd = z.coerce.number().nonnegative().parse(formData.get("valueUsd"));
  const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  await prisma.order.update({ where: { id: orderId }, data: { valueUsd } });

  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_VALUE_UPDATED",
    entityType: "Order",
    entityId: orderId,
    detail: `$${before.valueUsd.toLocaleString()} → $${valueUsd.toLocaleString()}`,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/financials");
}

export async function allocatePalletsAction(orderId: string) {
  const { picks } = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const alreadyAllocated = await tx.pallet.count({ where: { orderId } });
      const remaining = order.quantityPallets - alreadyAllocated;
      if (remaining <= 0) return { picks: [] };

      const picks = await suggestAllocation(
        {
          clientId: order.clientId,
          grade: order.grade,
          format: order.format,
          quantity: remaining,
        },
        tx
      );

      for (const p of picks) {
        await tx.pallet.update({
          where: { id: p.id, status: "IN_STORAGE" },
          data: { status: "ALLOCATED", clientId: order.clientId, orderId: order.id },
        });
      }

      return { picks };
    },
    { isolationLevel: "Serializable" }
  );

  // A zero-pick result (no stock, no lab clearance, or a spec fail) is no
  // longer explained via a one-time redirect banner -- the order detail
  // page's lifecycle tracker shows the same reason persistently, not just
  // right after a failed click.
  if (picks.length === 0) {
    revalidatePath(`/orders/${orderId}`);
    return;
  }

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_PALLETS_ALLOCATED",
    entityType: "Order",
    entityId: orderId,
    detail: `${picks.length} pallet(s) allocated`,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/storage");
}

const deliveredSchema = z.object({
  deliveredAt: z.string().min(1),
  deliveryReference: z.string().optional(),
});

/**
 * Delivered is a confirmation that the client actually received the goods --
 * nothing in the data can prove that, so unlike Shipped this stays manual.
 * Captures who/when/what-reference, the same accountability pattern every
 * other sign-off in this app already uses (e.g. Container's
 * loadOutRepName/loadOutSignedAt), instead of being a bare stage flip.
 */
export async function markOrderDeliveredAction(orderId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = deliveredSchema.safeParse({
    deliveredAt: formData.get("deliveredAt"),
    deliveryReference: formData.get("deliveryReference") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.cancelledAt) return "This order was cancelled.";
  if (normalizedStageIndex(order.stage) !== ORDER_STAGE_SEQUENCE.indexOf("SHIPPED")) {
    return "Cannot mark as Delivered: this order hasn't been marked Shipped yet.";
  }

  const session = await auth();
  await prisma.order.update({
    where: { id: orderId },
    data: {
      stage: "DELIVERED",
      deliveredAt: new Date(parsed.data.deliveredAt),
      deliveredByName: session?.user.name || session?.user.email,
      deliveredByUserId: session?.user.id,
      deliveryReference: parsed.data.deliveryReference,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_MARKED_DELIVERED",
    entityType: "Order",
    entityId: orderId,
    detail: parsed.data.deliveryReference,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

const paidSchema = z.object({
  paidAt: z.string().min(1),
  paymentReference: z.string().optional(),
});

/** Same reasoning as markOrderDeliveredAction -- payment is a real-world fact only a human can attest to. */
export async function markOrderPaidAction(orderId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = paidSchema.safeParse({
    paidAt: formData.get("paidAt"),
    paymentReference: formData.get("paymentReference") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.cancelledAt) return "This order was cancelled.";
  if (normalizedStageIndex(order.stage) !== ORDER_STAGE_SEQUENCE.indexOf("DELIVERED")) {
    return "Cannot mark as Paid: this order hasn't been marked Delivered yet.";
  }

  const session = await auth();
  await prisma.order.update({
    where: { id: orderId },
    data: {
      stage: "PAID",
      paidAt: new Date(parsed.data.paidAt),
      paidByName: session?.user.name || session?.user.email,
      paidByUserId: session?.user.id,
      paymentReference: parsed.data.paymentReference,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_MARKED_PAID",
    entityType: "Order",
    entityId: orderId,
    detail: parsed.data.paymentReference,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/financials");
}

const cancelSchema = z.object({
  cancellationReason: z.string().min(1),
});

/**
 * A client backing out previously had no real path -- the order just sat at
 * CONFIRMED forever. Refuses once shipping has actually happened (nothing
 * left to cancel by that point -- a real return/claim is the right tool
 * instead). Any pallets already allocated but not yet shipped are released
 * back to stock, same shape as how they were picked up in the first place.
 */
export async function cancelOrderAction(orderId: string, _prevState: string | undefined, formData: FormData) {
  const parsed = cancelSchema.safeParse({ cancellationReason: formData.get("cancellationReason") });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "A cancellation reason is required.";

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.cancelledAt) return "This order is already cancelled.";
  if (normalizedStageIndex(order.stage) >= ORDER_STAGE_SEQUENCE.indexOf("SHIPPED")) {
    return "Cannot cancel: this order has already shipped. Use a claim/return instead.";
  }

  const session = await auth();
  await prisma.$transaction(async (tx) => {
    await tx.pallet.updateMany({
      where: { orderId, status: "ALLOCATED" },
      data: { status: "IN_STORAGE", clientId: null, orderId: null },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        cancelledAt: new Date(),
        cancelledByName: session?.user.name || session?.user.email,
        cancelledByUserId: session?.user.id,
        cancellationReason: parsed.data.cancellationReason,
      },
    });
  });

  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_CANCELLED",
    entityType: "Order",
    entityId: orderId,
    detail: parsed.data.cancellationReason,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/storage");
  revalidatePath("/available-to-sell");
}
