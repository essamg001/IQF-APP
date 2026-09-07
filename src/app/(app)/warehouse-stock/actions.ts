"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canCheckWarehouseStock } from "@/lib/roles";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemCatalogSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  code: z.string().optional(),
  unit: z.string().optional(),
  minStockLevel: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function addWarehouseStockItemAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canCheckWarehouseStock(session?.user)) {
    return "Only the Owner or a Store Supervisor can manage the warehouse stock catalog.";
  }

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = itemCatalogSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.warehouseStockItem.findUnique({ where: { name: parsed.data.name } });
  if (existing) return `"${parsed.data.name}" is already in the stock catalog.`;

  await prisma.warehouseStockItem.create({ data: parsed.data });

  revalidatePath("/warehouse-stock");
  return "ok";
}

const logHeaderSchema = z.object({
  date: z.string().min(1),
  storeSupervisorName: z.string().optional(),
});

export async function updateWarehouseStockLogAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = logHeaderSchema.safeParse(raw);
  if (!parsed.success) return;

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return;

  await prisma.warehouseStockLog.upsert({
    where: { date },
    update: { storeSupervisorName: parsed.data.storeSupervisorName },
    create: { date, storeSupervisorName: parsed.data.storeSupervisorName },
  });

  revalidatePath("/warehouse-stock");
}

const logItemSchema = z.object({
  logId: z.string().min(1),
  itemId: z.string().min(1),
  openingBalance: z.coerce.number().nonnegative().optional(),
  quantityReceived: z.coerce.number().nonnegative().optional(),
  quantityUsed: z.coerce.number().nonnegative().optional(),
  quantityDamaged: z.coerce.number().nonnegative().optional(),
  issuedTo: z.string().optional(),
  reason: z.string().optional(),
});

export async function addWarehouseStockLogItemAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canCheckWarehouseStock(session?.user)) {
    return "Only the Owner or a Store Supervisor can record a stock-take entry.";
  }

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = logItemSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const item = await prisma.warehouseStockItem.findUnique({ where: { id: parsed.data.itemId } });
  if (!item) return "Unknown stock item.";

  const { itemId, ...rest } = parsed.data;
  const created = await prisma.warehouseStockLogItem.create({
    data: { ...rest, itemId, itemName: item.name, unit: item.unit },
  });

  await logActivity({
    actorId: session!.user.id,
    action: "WAREHOUSE_STOCK_ITEM_LOGGED",
    entityType: "WarehouseStockLogItem",
    entityId: created.id,
    detail: item.name,
  });

  revalidatePath("/warehouse-stock");
  return "ok";
}
