"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseDateSafe, parseLocalDateOnly } from "@/lib/dates";
import { z } from "zod";

function combineDateAndTime(dateStr: string, timeStr: string): Date | null {
  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  if (dateParts.length !== 3 || timeParts.length < 2) return null;
  const [year, month, day] = dateParts;
  const [hours, minutes] = timeParts;
  if ([year, month, day, hours, minutes].some((n) => Number.isNaN(n))) return null;
  const d = new Date(year, month - 1, day, hours, minutes);
  return isNaN(d.getTime()) ? null : d;
}

const temperatureSchema = z.object({
  factoryId: z.string().min(1),
  location: z.string().min(1),
  valueC: z.coerce.number(),
  recordedAt: z.string().optional(),
  notes: z.string().optional(),
});

export async function logTemperatureAction(_prevState: string | undefined, formData: FormData) {
  const parsed = temperatureSchema.safeParse({
    factoryId: formData.get("factoryId"),
    location: formData.get("location"),
    valueC: formData.get("valueC"),
    recordedAt: formData.get("recordedAt") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.dailyTemperatureLog.create({
    data: {
      factoryId: parsed.data.factoryId,
      location: parsed.data.location,
      valueC: parsed.data.valueC,
      notes: parsed.data.notes,
      recordedAt: parseDateSafe(parsed.data.recordedAt) ?? new Date(),
    },
  });

  revalidatePath("/daily-report");
  return "ok";
}

const quantitySchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  variety: z.string().min(1),
  firstBalanceTon: z.coerce.number().optional(),
  rawIncomingTon: z.coerce.number().optional(),
  rawIncomingPct: z.coerce.number().optional(),
  inletForOperationTon: z.coerce.number().optional(),
  inletForOperationPct: z.coerce.number().optional(),
  endBalanceTon: z.coerce.number().optional(),
  endBalancePct: z.coerce.number().optional(),
  firstClassWholeTon: z.coerce.number().optional(),
  firstClassWholePct: z.coerce.number().optional(),
  secondClassWholeTon: z.coerce.number().optional(),
  secondClassWholePct: z.coerce.number().optional(),
  rejectedBeforeTunnelTon: z.coerce.number().optional(),
  rejectedBeforeTunnelPct: z.coerce.number().optional(),
  rejectedAfterTunnelTon: z.coerce.number().optional(),
  rejectedAfterTunnelPct: z.coerce.number().optional(),
  totalPackedTon: z.coerce.number().optional(),
  totalPackedPct: z.coerce.number().optional(),
  lostTon: z.coerce.number().optional(),
  lostPct: z.coerce.number().optional(),
});

export async function addQuantityEntryAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = quantitySchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { date, ...rest } = parsed.data;
  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  await prisma.dailyQuantityEntry.create({ data: { ...rest, date: parsedDate } });

  revalidatePath("/daily-report");
  return "ok";
}

const packingSchema = z.object({
  date: z.string().min(1),
  factoryId: z.string().optional(),
  packageType: z.string().min(1),
  logo: z.string().min(1),
  weightKg: z.coerce.number().optional(),
  variety: z.string().optional(),
  clientId: z.string().optional(),
  clientOther: z.string().optional(),
  firstClassQty: z.coerce.number().int().optional(),
  secondClassQty: z.coerce.number().int().optional(),
  totalPackageQty: z.coerce.number().int().optional(),
  totalTon: z.coerce.number().optional(),
});

export async function addPackingLineAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = packingSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { date, ...rest } = parsed.data;
  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  await prisma.dailyPackingLine.create({ data: { ...rest, date: parsedDate } });

  revalidatePath("/daily-report");
  return "ok";
}

const downtimeSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  reason: z.string().min(1),
  fromTime: z.string().min(1),
  toTime: z.string().min(1),
});

export async function addDowntimeEventAction(_prevState: string | undefined, formData: FormData) {
  const parsed = downtimeSchema.safeParse({
    factoryId: formData.get("factoryId"),
    date: formData.get("date"),
    shiftType: formData.get("shiftType"),
    reason: formData.get("reason"),
    fromTime: formData.get("fromTime"),
    toTime: formData.get("toTime"),
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  let fromTime = combineDateAndTime(parsed.data.date, parsed.data.fromTime);
  let toTime = combineDateAndTime(parsed.data.date, parsed.data.toTime);
  if (!fromTime || !toTime) return "That time couldn't be read.";
  // A downtime window that crosses midnight (night shift) ends the next day.
  if (toTime <= fromTime) {
    toTime = new Date(toTime.getTime() + 24 * 60 * 60 * 1000);
  }

  await prisma.dailyDowntimeEvent.create({
    data: {
      factoryId: parsed.data.factoryId,
      date: parseLocalDateOnly(parsed.data.date) ?? new Date(parsed.data.date),
      shiftType: parsed.data.shiftType,
      reason: parsed.data.reason,
      fromTime,
      toTime,
    },
  });

  revalidatePath("/daily-report");
  return "ok";
}

export async function removeDowntimeEventAction(id: string) {
  await prisma.dailyDowntimeEvent.delete({ where: { id } });
  revalidatePath("/daily-report");
}

const efficiencySchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  uptimeFrom: z.string().optional(),
  uptimeTo: z.string().optional(),
  lineCapacityTonPerHour: z.coerce.number().optional(),
  expectedQuantityTon: z.coerce.number().optional(),
  actualQuantityTon: z.coerce.number().optional(),
});

export async function updateLineEfficiencyAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = efficiencySchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { factoryId, date, shiftType, uptimeFrom, uptimeTo, ...rest } = parsed.data;
  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const data = {
    ...rest,
    uptimeFrom: uptimeFrom ? combineDateAndTime(date, uptimeFrom) : null,
    uptimeTo: uptimeTo ? combineDateAndTime(date, uptimeTo) : null,
  };

  await prisma.dailyLineEfficiency.upsert({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
    create: { factoryId, date: parsedDate, shiftType, ...data },
    update: data,
  });

  revalidatePath("/daily-report");
  return "ok";
}
