"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateSlotsForColdRoom } from "@/lib/coldStorage";
import { logActivity } from "@/lib/activityLog";
import { getCompanySettings } from "@/lib/companySettings";

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

const factoryLaborRateSchema = z.object({
  hourlyWageUsd: z.coerce.number().nonnegative().optional(),
});

// A flat blended rate, deliberately kept separate from accreditation above --
// distinct concern (costing skeleton input, see /financials), just happens
// to also live on Factory. Gated the same way as accreditation: Owner only.
export async function updateFactoryLaborRateAction(factoryId: string, formData: FormData) {
  if (!(await requireOwner())) return;

  const raw = formData.get("hourlyWageUsd");
  const parsed = factoryLaborRateSchema.parse({ hourlyWageUsd: raw === "" ? undefined : raw });
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
  try {
    await prisma.field.delete({ where: { id } });
  } catch (err) {
    // Field is a required FK on ProductionLot -- Prisma refuses the delete
    // (P2003) rather than orphaning real production history. Redirect back
    // with an explanatory error instead of a raw 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect("/settings?error=field-in-use");
    }
    throw err;
  }
  revalidatePath("/settings");
}

const userSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    username: z
      .string()
      .min(2, "Username must be at least 2 characters.")
      .max(30)
      .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens.")
      .optional(),
    role: z.enum(["OWNER", "SALES", "QUALITY", "PRODUCTION", "LOGISTICS", "MAINTENANCE"]),
    password: z.string().min(6),
    isHeadOfSales: z.boolean(),
    isHeadOfProduction: z.boolean(),
    isHeadOfMaintenance: z.boolean(),
    station: z.enum(["ARRIVAL_INSPECTION", "POST_FREEZE_INSPECTION", "LOAD_OUT", "FINAL_PRODUCT_ENTRY", "LAB"]).optional(),
  })
  .refine((data) => Boolean(data.email || data.username), {
    message: "Provide an email, a username, or both.",
  });

export async function addUserAction(_prevState: string | undefined, formData: FormData) {
  if (!(await requireOwner())) return "Only the Owner can add users.";

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    username: formData.get("username") || undefined,
    role: formData.get("role"),
    password: formData.get("password"),
    isHeadOfSales: formData.get("isHeadOfSales") === "on",
    isHeadOfProduction: formData.get("isHeadOfProduction") === "on",
    isHeadOfMaintenance: formData.get("isHeadOfMaintenance") === "on",
    station: formData.get("station") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  if (parsed.data.email) {
    const existingEmail = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existingEmail) return "A user with this email already exists.";
  }
  if (parsed.data.username) {
    const existingUsername = await prisma.user.findUnique({ where: { username: parsed.data.username } });
    if (existingUsername) return "A user with this username already exists.";
  }

  // `email` stays a required column even for username-only accounts (every
  // other `user.email` usage in the app -- alert emails, activity log
  // detail lines -- assumes it's always a string), so a login-only username
  // gets a non-deliverable placeholder here. It's never shown to the user.
  const email = parsed.data.email ?? `${parsed.data.username}@no-email.internal`;

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      username: parsed.data.username,
      role: parsed.data.role,
      isHeadOfSales: parsed.data.isHeadOfSales,
      isHeadOfProduction: parsed.data.isHeadOfProduction,
      isHeadOfMaintenance: parsed.data.isHeadOfMaintenance,
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
    detail: `${created.name} (${created.username ? `@${created.username}` : created.email}) — ${created.role}`,
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

// Not gated to a specific Role either -- there's no dedicated "Purchasing"
// role, same reasoning as toggleHeadOfMaintenanceAction above.
export async function toggleHeadOfPurchasingAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfPurchasing: !user.isHeadOfPurchasing } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_HEAD_OF_PURCHASING_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isHeadOfPurchasing}`,
  });

  revalidatePath("/settings");
}

// Not gated to a specific Role either -- there's no dedicated "Warehouse"
// role, same reasoning as toggleHeadOfMaintenanceAction above.
export async function toggleStoreSupervisorAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isStoreSupervisor: !user.isStoreSupervisor } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_STORE_SUPERVISOR_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isStoreSupervisor}`,
  });

  revalidatePath("/settings");
}

// Not gated to a specific Role either -- there's no dedicated "Accounting"
// role, same reasoning as toggleHeadOfMaintenanceAction above.
export async function toggleHeadOfAccountingAction(id: string) {
  if (!(await requireOwner())) return;
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfAccounting: !user.isHeadOfAccounting } });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "USER_HEAD_OF_ACCOUNTING_TOGGLED",
    entityType: "User",
    entityId: id,
    detail: `${user.name} → ${!user.isHeadOfAccounting}`,
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
