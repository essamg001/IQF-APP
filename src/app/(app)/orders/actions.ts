"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { suggestAllocation } from "@/lib/allocation";
import { ORDER_STAGE_SEQUENCE } from "@/lib/orderLifecycle";
import { logActivity } from "@/lib/activityLog";
import { canSeePricing } from "@/lib/roles";
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
  // client agrees to gets converted to whole pallets at 1.2t each.
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
  if (!canSeePricing(session?.user?.role)) return;

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

export async function advanceOrderStageAction(
  orderId: string,
  _prevState: string | undefined,
  _formData: FormData
) {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { pallets: { select: { status: true, palletNumber: true } } },
  });
  const idx = ORDER_STAGE_SEQUENCE.indexOf(order.stage);
  const next = ORDER_STAGE_SEQUENCE[idx + 1];
  if (!next) return;

  // Advancing to Shipped is a confirmation that shipping already happened
  // correctly, not a command that ships things -- a pallet only ever becomes
  // SHIPPED via addPalletLoadLineAction (logistics/actions.ts), which checks
  // microbiology/shift-hold at the moment it's loaded. Refusing to advance
  // until every allocated pallet is already SHIPPED means there's no second,
  // ungated door to the same status.
  if (next === "SHIPPED") {
    if (order.pallets.length === 0) {
      return "Cannot mark as Shipped: no pallets have been allocated to this order yet.";
    }
    const notYetShipped = order.pallets.filter((p) => p.status !== "SHIPPED");
    if (notYetShipped.length > 0) {
      const sample = notYetShipped.slice(0, 3).map((p) => p.palletNumber).join(", ");
      const more = notYetShipped.length > 3 ? ` and ${notYetShipped.length - 3} more` : "";
      return `Cannot mark as Shipped: ${notYetShipped.length} pallet(s) haven't been fully loaded into a container yet (${sample}${more}). Load them out in Logistics -- each one ships automatically once fully loaded and cleared.`;
    }
  }

  await prisma.order.update({ where: { id: orderId }, data: { stage: next } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "ORDER_STAGE_ADVANCED",
    entityType: "Order",
    entityId: orderId,
    detail: `${order.stage} → ${next}`,
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/storage");
}
