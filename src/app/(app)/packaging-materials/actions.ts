"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const headerSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  finalProduct: z.string().optional(),
  storeName: z.string().optional(),
  packhouseManagerName: z.string().optional(),
  storeSupervisorName: z.string().optional(),
});

export async function updatePackagingMaterialsDailyLogAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) return;

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return;

  const { factoryId, date: _d, ...rest } = parsed.data;
  await prisma.packagingMaterialsDailyLog.upsert({
    where: { factoryId_date: { factoryId, date } },
    update: rest,
    create: { factoryId, date, ...rest },
  });

  revalidatePath("/packaging-materials");
}

const itemSchema = z.object({
  dailyLogId: z.string().min(1),
  itemName: z.string().min(1),
  productCode: z.string().optional(),
  productUnit: z.string().optional(),
  minLevel: z.coerce.number().int().nonnegative().optional(),
  maxLevel: z.coerce.number().int().nonnegative().optional(),
  openingBalance: z.coerce.number().int().nonnegative().optional(),
  quantityReceived: z.coerce.number().int().nonnegative().optional(),
  quantityUsed: z.coerce.number().int().nonnegative().optional(),
  quantityDamaged: z.coerce.number().int().nonnegative().optional(),
  receiptOrVoucherNumber: z.string().optional(),
  supplyOrIssueDestination: z.string().optional(),
  expiryDate: z.string().optional(),
  storageLocation: z.string().optional(),
  lotNumber: z.string().optional(),
  storeKeeperName: z.string().optional(),
});

export async function addPackagingMaterialItemAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { expiryDate, ...rest } = parsed.data;
  const created = await prisma.packagingMaterialItem.create({
    data: { ...rest, expiryDate: expiryDate ? parseLocalDateOnly(expiryDate) : undefined },
  });

  await logActivity({
    actorId: session.user.id,
    action: "PACKAGING_MATERIAL_ITEM_ADDED",
    entityType: "PackagingMaterialItem",
    entityId: created.id,
    detail: parsed.data.itemName,
  });

  revalidatePath("/packaging-materials");
  return "ok";
}
