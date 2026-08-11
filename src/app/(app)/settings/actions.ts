"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateSlotsForColdRoom } from "@/lib/coldStorage";
import { logActivity } from "@/lib/activityLog";
import { getCompanySettings } from "@/lib/companySettings";
import { canSeeCosting } from "@/lib/roles";

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
  if (!(await requireOwner())) return;

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
  if (!(await requireOwner())) return;

  const parsed = factoryAccreditationSchema.parse({
    capqExportCode: formData.get("capqExportCode") || undefined,
    nfsaAccreditationCode: formData.get("nfsaAccreditationCode") || undefined,
  });
  await prisma.factory.update({ where: { id: factoryId }, data: parsed });
  revalidatePath("/settings");
}

export async function addColdRoomAction(formData: FormData) {
  if (!(await requireOwner())) return;

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
  if (!(await requireOwner())) return;

  const parsed = fieldSchema.parse({
    name: formData.get("name"),
    mapReference: formData.get("mapReference") || undefined,
  });
  await prisma.field.create({ data: parsed });
  revalidatePath("/settings");
}

export async function deleteFieldAction(id: string) {
  if (!(await requireOwner())) return;
  await prisma.field.delete({ where: { id } });
  revalidatePath("/settings");
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "SALES", "QUALITY", "PRODUCTION", "LOGISTICS"]),
  password: z.string().min(6),
  isHeadOfSales: z.boolean(),
  isHeadOfProduction: z.boolean(),
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
    isHeadOfProduction: formData.get("isHeadOfProduction") === "on",
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
      isHeadOfProduction: parsed.data.isHeadOfProduction,
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

export async function toggleHeadOfProductionAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfProduction: !user.isHeadOfProduction } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_HEAD_OF_PRODUCTION_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isHeadOfProduction}`,
  });

  revalidatePath("/settings");
}

// Not gated to a specific Role like the two toggles above -- there's no
// dedicated "Maintenance" role in this app, so the Owner can grant this to
// whichever user actually holds that responsibility, regardless of theirs.
export async function toggleHeadOfMaintenanceAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfMaintenance: !user.isHeadOfMaintenance } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_HEAD_OF_MAINTENANCE_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isHeadOfMaintenance}`,
  });

  revalidatePath("/settings");
}

const costingRatesSchema = z.object({
  fxRateEgpPerUsd: z.coerce.number().positive().optional(),
  laborHourlyRateEgp: z.coerce.number().nonnegative().optional(),
});

// Same page-gate-plus-server-recheck reasoning as requireOwner() above --
// canSeeCosting narrows this to Owner + Head of Sales/Export, matching every
// other costing-related view in the app.
export async function updateCostingRatesAction(formData: FormData) {
  const session = await auth();
  if (!canSeeCosting(session?.user)) return;

  const parsed = costingRatesSchema.parse({
    fxRateEgpPerUsd: formData.get("fxRateEgpPerUsd") || undefined,
    laborHourlyRateEgp: formData.get("laborHourlyRateEgp") || undefined,
  });

  const settings = await getCompanySettings();
  await prisma.companySettings.update({ where: { id: settings.id }, data: parsed });

  await logActivity({
    actorId: session?.user.id,
    action: "COSTING_RATES_UPDATED",
    entityType: "CompanySettings",
    entityId: settings.id,
    detail: `FX ${parsed.fxRateEgpPerUsd ?? "—"} EGP/USD, wage ${parsed.laborHourlyRateEgp ?? "—"} EGP/hr`,
  });

  revalidatePath("/settings");
}

const farmAccreditationSchema = z.object({
  globalGapNumber: z.string().optional(),
  globalGapExpiry: z.string().optional(),
});

// Every field currently shares one farm-level GlobalG.A.P. certification, so
// this is a single company-wide fact (see CompanySettings) rather than
// something repeated per Field row.
export async function updateFarmAccreditationAction(formData: FormData) {
  const session = await auth();
  if (!(await requireOwner())) return;

  const parsed = farmAccreditationSchema.parse({
    globalGapNumber: formData.get("globalGapNumber") || undefined,
    globalGapExpiry: formData.get("globalGapExpiry") || undefined,
  });

  const settings = await getCompanySettings();
  await prisma.companySettings.update({
    where: { id: settings.id },
    data: {
      globalGapNumber: parsed.globalGapNumber,
      globalGapExpiry: parsed.globalGapExpiry ? new Date(parsed.globalGapExpiry) : undefined,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "FARM_ACCREDITATION_UPDATED",
    entityType: "CompanySettings",
    entityId: settings.id,
    detail: `GlobalG.A.P. ${parsed.globalGapNumber ?? "—"}, expires ${parsed.globalGapExpiry ?? "—"}`,
  });

  revalidatePath("/settings");
}
