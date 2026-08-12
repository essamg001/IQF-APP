"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseLocalDateOnly } from "@/lib/dates";
import { logActivity } from "@/lib/activityLog";
import { GARMENT_TYPES } from "@/lib/laundry";

const garmentFields = Object.fromEntries(GARMENT_TYPES.map((g) => [g.key, z.string().optional()]));

const laundryRecordSchema = z.object({
  date: z.string().min(1),
  packhouse: z.string().min(1),
  workerName: z.string().min(1),
  comments: z.string().optional(),
  ...garmentFields,
});

export async function createLaundryRecordAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = laundryRecordSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const session = await auth();
  const { date: _date, workerName, packhouse, comments, ...garments } = parsed.data;

  const created = await prisma.laundryRecord.create({
    data: {
      date,
      packhouse,
      workerName: workerName.trim(),
      comments,
      ...garments,
      recordedByName: session?.user.name ?? session?.user.email ?? undefined,
      recordedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "LAUNDRY_RECORD_LOGGED",
    entityType: "LaundryRecord",
    entityId: created.id,
    detail: created.workerName,
  });

  revalidatePath("/laundry");
  return "ok";
}

const washCycleSchema = z.object({
  date: z.string().min(1),
  location: z.string().min(1),
  itemType: z.string().min(1),
  count: z.coerce.number().optional(),
  purpose: z.string().optional(),
  waterTemperatureC: z.coerce.number().optional(),
  agent: z.string().optional(),
  concentration: z.string().optional(),
  timeFrom: z.string().optional(),
  timeTo: z.string().optional(),
  amountOfAgent: z.string().optional(),
  dryerTemperatureC: z.coerce.number().optional(),
});

export async function createLaundryWashCycleAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = washCycleSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const session = await auth();
  const { date: _date, ...data } = parsed.data;

  const created = await prisma.laundryWashCycle.create({
    data: {
      ...data,
      date,
      recordedByName: session?.user.name ?? session?.user.email ?? undefined,
      recordedByUserId: session?.user.id,
    },
  });

  await logActivity({
    actorId: session?.user.id,
    action: "LAUNDRY_WASH_CYCLE_LOGGED",
    entityType: "LaundryWashCycle",
    entityId: created.id,
    detail: created.itemType,
  });

  revalidatePath("/laundry");
  return "ok";
}

const signOffDetailsSchema = z.object({
  date: z.string().min(1),
  location: z.string().min(1),
  notes: z.string().optional(),
  cleanlinessAcceptable: z.string().optional(),
});

async function getSignOff(date: Date, location: string) {
  return prisma.laundryDailySignOff.findUnique({ where: { date_location: { date, location } } });
}

export async function updateLaundrySignOffDetailsAction(formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = signOffDetailsSchema.safeParse(raw);
  if (!parsed.success) return;

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return;

  const cleanlinessAcceptable =
    parsed.data.cleanlinessAcceptable === "ACCEPTABLE"
      ? true
      : parsed.data.cleanlinessAcceptable === "NOT_ACCEPTABLE"
        ? false
        : undefined;

  await prisma.laundryDailySignOff.upsert({
    where: { date_location: { date, location: parsed.data.location } },
    update: { notes: parsed.data.notes, cleanlinessAcceptable },
    create: { date, location: parsed.data.location, notes: parsed.data.notes, cleanlinessAcceptable },
  });

  revalidatePath("/laundry");
}

const signRoleSchema = z.enum(["SUPERVISOR", "VERIFIER"]);

// Two-signature sign-off, mirroring Cleaning's pattern -- refused if the
// same person already holds the other signature for this date/location.
export async function signLaundryAction(
  date: string,
  location: string,
  roleRaw: string,
  _prevState: string | undefined,
  _formData: FormData
) {
  const roleParsed = signRoleSchema.safeParse(roleRaw);
  if (!roleParsed.success) return "Invalid input.";
  const role = roleParsed.data;

  const session = await auth();
  if (!session?.user) return "You must be logged in to sign off.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const record = await getSignOff(parsedDate, location);
  if (role === "SUPERVISOR" && record?.supervisorSignedAt) return "ok";
  if (role === "VERIFIER" && record?.verifiedSignedAt) return "ok";

  if (role === "SUPERVISOR" && record?.verifiedSignedByUserId === session.user.id) {
    return "You've already signed off as Verified By for this day -- the two sign-offs must be different people.";
  }
  if (role === "VERIFIER" && record?.supervisorSignedByUserId === session.user.id) {
    return "You've already signed off as Supervisor for this day -- the two sign-offs must be different people.";
  }

  const name = session.user.name || session.user.email;
  const data =
    role === "SUPERVISOR"
      ? { supervisorSignedByName: name, supervisorSignedByUserId: session.user.id, supervisorSignedAt: new Date() }
      : { verifiedSignedByName: name, verifiedSignedByUserId: session.user.id, verifiedSignedAt: new Date() };

  await prisma.laundryDailySignOff.upsert({
    where: { date_location: { date: parsedDate, location } },
    create: { date: parsedDate, location, ...data },
    update: data,
  });

  await logActivity({
    actorId: session.user.id,
    action: role === "SUPERVISOR" ? "LAUNDRY_SUPERVISOR_SIGNED" : "LAUNDRY_VERIFIED_SIGNED",
    entityType: "LaundryDailySignOff",
    entityId: `${location}/${date}`,
  });

  revalidatePath("/laundry");
  return "ok";
}
