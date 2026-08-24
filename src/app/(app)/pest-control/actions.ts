"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { raiseRodentDetectedAlert } from "@/lib/alerts";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const lightTrapSchema = z.object({
  factoryId: z.string().min(1),
  trapNumber: z.string().min(1),
  location: z.string().optional(),
});

export async function addLightTrapAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = lightTrapSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.lightTrap.create({ data: parsed.data });

  await logActivity({
    actorId: session.user.id,
    action: "LIGHT_TRAP_ADDED",
    entityType: "LightTrap",
    entityId: created.id,
    detail: `Trap #${parsed.data.trapNumber}`,
  });

  revalidatePath("/pest-control");
  return "ok";
}

const lightTrapCheckSchema = z.object({
  trapId: z.string().min(1),
  date: z.string().min(1),
  fliesCount: z.coerce.number().int().nonnegative().optional(),
  beesCount: z.coerce.number().int().nonnegative().optional(),
  waspsCount: z.coerce.number().int().nonnegative().optional(),
  mothsCount: z.coerce.number().int().nonnegative().optional(),
  mosquitoesCount: z.coerce.number().int().nonnegative().optional(),
  otherCount: z.coerce.number().int().nonnegative().optional(),
  stickyPadChanged: z.string().optional(),
  checkedByName: z.string().optional(),
  notes: z.string().optional(),
});

export async function addLightTrapCheckAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = lightTrapCheckSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const { trapId, date: _d, stickyPadChanged, ...rest } = parsed.data;
  const data = { ...rest, stickyPadChanged: stickyPadChanged === "on" };

  const upserted = await prisma.lightTrapCheck.upsert({
    where: { trapId_date: { trapId, date } },
    update: data,
    create: { trapId, date, ...data },
  });

  await logActivity({
    actorId: session.user.id,
    action: "LIGHT_TRAP_CHECKED",
    entityType: "LightTrapCheck",
    entityId: upserted.id,
  });

  revalidatePath("/pest-control");
  return "ok";
}

const rodentTrapSchema = z.object({
  factoryId: z.string().min(1),
  trapType: z.enum(["BAIT_STATION", "GLUE_TRAP"]),
  trapNumber: z.string().min(1),
  location: z.string().optional(),
});

export async function addRodentTrapAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = rodentTrapSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.rodentTrap.create({ data: parsed.data });

  await logActivity({
    actorId: session.user.id,
    action: "RODENT_TRAP_ADDED",
    entityType: "RodentTrap",
    entityId: created.id,
    detail: `${parsed.data.trapType} #${parsed.data.trapNumber}`,
  });

  revalidatePath("/pest-control");
  return "ok";
}

const rodentCheckSchema = z.object({
  trapId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum([
    "INTACT",
    "WET",
    "SPOILED",
    "EATEN_TRACE",
    "MISSING",
    "BROKEN",
    "DISPLACED",
    "LIVE_RODENT",
    "DEAD_RODENT",
    "GOOD",
    "NOT_GOOD",
    "OTHER",
  ]),
  checkedByName: z.string().optional(),
  notes: z.string().optional(),
});

export async function addRodentTrapCheckAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = rodentCheckSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const trap = await prisma.rodentTrap.findUniqueOrThrow({ where: { id: parsed.data.trapId } });

  const { trapId, date: _d, ...data } = parsed.data;
  const upserted = await prisma.rodentTrapCheck.upsert({
    where: { trapId_date: { trapId, date } },
    update: data,
    create: { trapId, date, ...data },
  });

  await logActivity({
    actorId: session.user.id,
    action: "RODENT_TRAP_CHECKED",
    entityType: "RodentTrapCheck",
    entityId: upserted.id,
    detail: data.status === "LIVE_RODENT" || data.status === "DEAD_RODENT" ? data.status : undefined,
  });

  if (data.status === "LIVE_RODENT" || data.status === "DEAD_RODENT") {
    await raiseRodentDetectedAlert({
      trapId: trap.id,
      trapNumber: trap.trapNumber,
      trapType: trap.trapType,
      status: data.status,
    });
  }

  revalidatePath("/pest-control");
  return "ok";
}
