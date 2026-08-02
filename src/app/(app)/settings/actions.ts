"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateSlotsForColdRoom } from "@/lib/coldStorage";
import { logActivity } from "@/lib/activityLog";

// User management (create/delete/promote) is Owner-only on the page (see
// settings/page.tsx's `isOwner` gate on the Users card) -- but a Server
// Action is its own callable endpoint independent of what a page renders,
// so the page-level gate alone doesn't stop a non-Owner from invoking these
// directly. Re-checking here is what actually enforces it.
async function requireOwner() {
  const session = await auth();
  return session?.user.role === "OWNER";
}

const factorySchema = z.object({
  name: z.string().min(1),
  capacityTonnesPerHour: z.coerce.number().positive(),
});

const coldRoomSchema = z.object({
  name: z.string().min(1),
  rounds: z.coerce.number().int().positive(),
  rackCount: z.coerce.number().int().positive(),
  levelCount: z.coerce.number().int().positive(),
  isNew: z.boolean(),
});

const fieldSchema = z.object({
  name: z.string().min(1),
  mapReference: z.string().optional(),
});

export async function addFactoryAction(formData: FormData) {
  const parsed = factorySchema.parse({
    name: formData.get("name"),
    capacityTonnesPerHour: formData.get("capacityTonnesPerHour"),
  });
  await prisma.factory.create({ data: parsed });
  revalidatePath("/settings");
}

const factoryAccreditationSchema = z.object({
  capqExportCode: z.string().optional(),
  nfsaAccreditationCode: z.string().optional(),
});

// Produce from an un-coded or unauthorized packing house can't legally be
// exported -- this is the factory's own standing export eligibility, not
// paperwork for one particular shipment (see Container's per-shipment
// export documents for that).
export async function updateFactoryAccreditationAction(factoryId: string, formData: FormData) {
  const parsed = factoryAccreditationSchema.parse({
    capqExportCode: formData.get("capqExportCode") || undefined,
    nfsaAccreditationCode: formData.get("nfsaAccreditationCode") || undefined,
  });
  await prisma.factory.update({ where: { id: factoryId }, data: parsed });
  revalidatePath("/settings");
}

export async function addColdRoomAction(formData: FormData) {
  const parsed = coldRoomSchema.parse({
    name: formData.get("name"),
    rounds: formData.get("rounds"),
    rackCount: formData.get("rackCount"),
    levelCount: formData.get("levelCount"),
    isNew: formData.get("isNew") === "on",
  });
  const capacityPallets = parsed.rounds * parsed.rackCount * parsed.levelCount;
  const room = await prisma.coldRoom.create({ data: { ...parsed, capacityPallets } });
  await generateSlotsForColdRoom(room.id, parsed.rounds, parsed.rackCount, parsed.levelCount);
  revalidatePath("/settings");
}

export async function addFieldAction(formData: FormData) {
  const parsed = fieldSchema.parse({
    name: formData.get("name"),
    mapReference: formData.get("mapReference") || undefined,
  });
  await prisma.field.create({ data: parsed });
  revalidatePath("/settings");
}

export async function deleteFieldAction(id: string) {
  await prisma.field.delete({ where: { id } });
  revalidatePath("/settings");
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "SALES", "QUALITY", "PRODUCTION", "LOGISTICS"]),
  password: z.string().min(6),
  isHeadOfSales: z.boolean(),
  station: z.enum(["ARRIVAL_INSPECTION", "POST_FREEZE_INSPECTION", "LOAD_OUT", "FINAL_PRODUCT_ENTRY", "LAB"]).optional(),
});

export async function addUserAction(_prevState: string | undefined, formData: FormData) {
  if (!(await requireOwner())) return "Only the Owner can add users.";

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
    isHeadOfSales: formData.get("isHeadOfSales") === "on",
    station: formData.get("station") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return "A user with this email already exists.";

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      isHeadOfSales: parsed.data.isHeadOfSales,
      station: parsed.data.station,
      passwordHash,
    },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_ADDED",
    entityType: "User",
    entityId: created.id,
    detail: `${created.name} (${created.email}) — ${created.role}`,
  });

  revalidatePath("/settings");
}

export async function deleteUserAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUnique({ where: { id } });
  await prisma.user.delete({ where: { id } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: id,
    detail: user ? `${user.name} (${user.email})` : undefined,
  });

  revalidatePath("/settings");
}

export async function toggleHeadOfSalesAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfSales: !user.isHeadOfSales } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_HEAD_OF_SALES_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isHeadOfSales}`,
  });

  revalidatePath("/settings");
}
