"use server";

import { prisma } from "@/lib/prisma";
import { suggestAllocation } from "@/lib/allocation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const orderSchema = z.object({
  orderNumber: z.string().min(1),
  clientId: z.string().min(1),
  grade: z.enum(["A", "B"]),
  format: z.enum(["WHOLE", "SLICED", "DICED"]),
  quantityPallets: z.coerce.number().int().positive(),
  valueUsd: z.coerce.number().nonnegative(),
  orderDate: z.string().min(1),
});

export async function createOrderAction(_prevState: string | undefined, formData: FormData) {
  const parsed = orderSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    clientId: formData.get("clientId"),
    grade: formData.get("grade"),
    format: formData.get("format"),
    quantityPallets: formData.get("quantityPallets"),
    valueUsd: formData.get("valueUsd"),
    orderDate: formData.get("orderDate"),
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.order.findUnique({ where: { orderNumber: parsed.data.orderNumber } });
  if (existing) return "An order with this number already exists.";

  const order = await prisma.order.create({
    data: { ...parsed.data, orderDate: new Date(parsed.data.orderDate) },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
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
