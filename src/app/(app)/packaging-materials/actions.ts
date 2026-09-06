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
  materialId: z.string().min(1),
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

  const material = await prisma.packagingMaterial.findUnique({ where: { id: parsed.data.materialId } });
  if (!material) return "Unknown material.";

  const { expiryDate, materialId, ...rest } = parsed.data;
  const created = await prisma.packagingMaterialItem.create({
    data: {
      ...rest,
      materialId,
      itemName: material.name,
      productCode: material.code,
      productUnit: material.unit,
      expiryDate: expiryDate ? parseLocalDateOnly(expiryDate) : undefined,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "PACKAGING_MATERIAL_ITEM_ADDED",
    entityType: "PackagingMaterialItem",
    entityId: created.id,
    detail: material.name,
  });

  revalidatePath("/packaging-materials");
  return "ok";
}

const materialSchema = z.object({
  factoryId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().optional(),
  unit: z.string().optional(),
  minStockLevel: z.coerce.number().nonnegative().optional(),
  consumptionRatioPerTon: z.coerce.number().nonnegative().optional(),
  quantityPerCarton: z.coerce.number().nonnegative().optional(),
  quantityPerPallet: z.coerce.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function addPackagingMaterialAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = materialSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const existing = await prisma.packagingMaterial.findUnique({
    where: { factoryId_name: { factoryId: parsed.data.factoryId, name: parsed.data.name } },
  });
  if (existing) return `"${parsed.data.name}" is already in the materials list.`;

  await prisma.packagingMaterial.create({ data: parsed.data });

  revalidatePath("/packaging-materials");
  return "ok";
}
