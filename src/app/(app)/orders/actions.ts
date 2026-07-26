"use server";

import { prisma } from "@/lib/prisma";
import { suggestAllocation } from "@/lib/allocation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const PALLET_WEIGHT_TONNES = 1.2;

const orderSchema = z.object({
  poNumber: z.string().optional(),
  clientId: z.string().min(1),
  grade: z.enum(["A", "B"]),
  format: z.enum(["WHOLE", "SLICED", "DICED"]),
  quantityTonnes: z.coerce.number().positive(),
  orderDate: z.string().min(1),
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
    orderDate: formData.get("orderDate"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const { quantityTonnes, ...rest } = parsed.data;
  // Pallets are the actual allocatable unit in storage, so the tonnage the
  // client agrees to gets converted to whole pallets at 1.2t each.
  const quantityPallets = Math.max(1, Math.round(quantityTonnes / PALLET_WEIGHT_TONNES));
  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: { ...rest, orderNumber, quantityPallets, valueUsd: 0, orderDate: new Date(rest.orderDate) },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function updateOrderValueAction(orderId: string, formData: FormData) {
  const valueUsd = z.coerce.number().nonnegative().parse(formData.get("valueUsd"));
  await prisma.order.update({ where: { id: orderId }, data: { valueUsd } });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
}

export async function allocatePalletsAction(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const alreadyAllocated = await prisma.pallet.count({ where: { orderId } });
  const remaining = order.quantityPallets - alreadyAllocated;
  if (remaining <= 0) return;

  const picks = await suggestAllocation({
    clientId: order.clientId,
    grade: order.grade,
    format: order.format,
    quantity: remaining,
  });

  await prisma.$transaction(
    picks.map((p) =>
      prisma.pallet.update({
        where: { id: p.id },
        data: { status: "ALLOCATED", clientId: order.clientId, orderId: order.id },
      })
    )
  );

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/storage");
}

const STAGE_ORDER = ["CONFIRMED", "IN_PRODUCTION", "PACKED", "SHIPPED", "DELIVERED", "PAID"] as const;

export async function advanceOrderStageAction(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const idx = STAGE_ORDER.indexOf(order.stage);
  const next = STAGE_ORDER[idx + 1];
  if (!next) return;

  await prisma.order.update({ where: { id: orderId }, data: { stage: next } });

  if (next === "SHIPPED") {
    await prisma.pallet.updateMany({ where: { orderId }, data: { status: "SHIPPED" } });
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/storage");
}
