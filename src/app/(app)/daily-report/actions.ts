"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseDateSafe, parseLocalDateOnly } from "@/lib/dates";
import { getTemperatureLocations } from "@/lib/dailyReportLocations";
import { isNameBasedRole, LABOUR_ROLE_MATRIX } from "@/lib/labour";
import { z } from "zod";

const pct = () => z.coerce.number().min(0).max(100).optional();

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

const temperatureBatchSchema = z.object({
  factoryId: z.string().min(1),
  factoryCode: z.string().optional(),
  recordedAt: z.string().optional(),
  checkedByName: z.string().optional(),
  notes: z.string().optional(),
});

// One small box per location (see log-temperature-form.tsx) posts here as a
// single round -- every non-empty box becomes its own DailyTemperatureLog
// row sharing the same recordedAt/notes, instead of requiring one form
// submission per location.
export async function logTemperatureBatchAction(_prevState: string | undefined, formData: FormData) {
  const parsed = temperatureBatchSchema.safeParse({
    factoryId: formData.get("factoryId"),
    factoryCode: formData.get("factoryCode") || undefined,
    recordedAt: formData.get("recordedAt") || undefined,
    checkedByName: formData.get("checkedByName") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const locations = getTemperatureLocations(parsed.data.factoryCode);
  const recordedAt = parseDateSafe(parsed.data.recordedAt) ?? new Date();

  const readings = locations
    .map((loc) => ({ location: loc.name, raw: formData.get(loc.name) }))
    .filter((r) => r.raw != null && String(r.raw).trim() !== "")
    .map((r) => ({ location: r.location, valueC: Number(r.raw) }))
    .filter((r) => !Number.isNaN(r.valueC));

  if (readings.length === 0) return "Enter at least one reading.";

  await prisma.dailyTemperatureLog.createMany({
    data: readings.map((r) => ({
      factoryId: parsed.data.factoryId,
      location: r.location,
      valueC: r.valueC,
      checkedByName: parsed.data.checkedByName,
      notes: parsed.data.notes,
      recordedAt,
    })),
  });

  revalidatePath("/daily-report");
  return "ok";
}

const quantitySchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  shiftType: z.enum(["DAY", "NIGHT"]),
  variety: z.string().min(1),
  firstBalanceTon: z.coerce.number().nonnegative().optional(),
  rawIncomingTon: z.coerce.number().nonnegative().optional(),
  rawIncomingPct: pct(),
  inletForOperationTon: z.coerce.number().nonnegative().optional(),
  inletForOperationPct: pct(),
  endBalanceTon: z.coerce.number().nonnegative().optional(),
  endBalancePct: pct(),
  firstClassWholeTon: z.coerce.number().nonnegative().optional(),
  firstClassWholePct: pct(),
  secondClassWholeTon: z.coerce.number().nonnegative().optional(),
  secondClassWholePct: pct(),
  rejectedBeforeTunnelTon: z.coerce.number().nonnegative().optional(),
  rejectedBeforeTunnelPct: pct(),
  rejectedAfterTunnelTon: z.coerce.number().nonnegative().optional(),
  rejectedAfterTunnelPct: pct(),
  totalPackedTon: z.coerce.number().nonnegative().optional(),
  totalPackedPct: pct(),
  lostTon: z.coerce.number().nonnegative().optional(),
  lostPct: pct(),
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

// Same "remove and re-add" correction pattern as removeDowntimeEventAction --
// there's no per-field edit UI here, so a mistaken row is fixed by deleting
// it and logging it again correctly, rather than left with no way to fix it.
export async function removeQuantityEntryAction(id: string) {
  await prisma.dailyQuantityEntry.delete({ where: { id } });
  revalidatePath("/daily-report");
}

const packingSchema = z.object({
  date: z.string().min(1),
  factoryId: z.string().optional(),
  packageType: z.string().min(1),
  logo: z.string().min(1),
  weightKg: z.coerce.number().nonnegative().optional(),
  variety: z.string().optional(),
  clientId: z.string().optional(),
  clientOther: z.string().optional(),
  firstClassQty: z.coerce.number().int().nonnegative().optional(),
  secondClassQty: z.coerce.number().int().nonnegative().optional(),
  totalPackageQty: z.coerce.number().int().nonnegative().optional(),
  totalTon: z.coerce.number().nonnegative().optional(),
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

export async function removePackingLineAction(id: string) {
  await prisma.dailyPackingLine.delete({ where: { id } });
  revalidatePath("/daily-report");
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
  lineCapacityTonPerHour: z.coerce.number().nonnegative().optional(),
  expectedQuantityTon: z.coerce.number().nonnegative().optional(),
  actualQuantityTon: z.coerce.number().nonnegative().optional(),
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

  // Log Shift doesn't ask for an end time -- it's expected to come from here,
  // the shift's actual recorded line uptime, once the day's Daily Report is
  // filled in. Only fills a still-open end time; never overwrites one that's
  // already on file, in case it was deliberately entered by hand.
  if (data.uptimeTo) {
    const openShift = await prisma.shiftLog.findFirst({
      where: { factoryId, date: parsedDate, shiftType, endTime: null },
    });
    if (openShift) {
      let endTime = data.uptimeTo;
      // Night shifts cross midnight -- if the recorded end time isn't after
      // the start time, it belongs to the following day.
      if (endTime <= openShift.startTime) {
        endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
      }
      await prisma.shiftLog.update({ where: { id: openShift.id }, data: { endTime } });
      revalidatePath("/shifts");
      revalidatePath(`/shifts/${openShift.id}`);
    }
  }

  revalidatePath("/daily-report");
  return "ok";
}

const decapEfficiencySchema = z.object({
  date: z.string().min(1),
  weightOutKg: z.coerce.number().nonnegative().optional(),
  calyxKg: z.coerce.number().nonnegative().optional(),
});

export async function updateDecapEfficiencyAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = decapEfficiencySchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { date, ...rest } = parsed.data;
  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  await prisma.decapDailyLog.upsert({
    where: { date: parsedDate },
    create: { date: parsedDate, ...rest },
    update: rest,
  });

  revalidatePath("/daily-report");
  return "ok";
}

const departmentLabourEntrySchema = z.object({
  department: z.enum([
    "INTAKE",
    "INFEED",
    "PROCESSING",
    "OPERATIONS_EFFICIENCY",
    "QUALITY_CONTROL",
    "MAINTENANCE_ENGINEERING",
    "PACKAGING",
    "LOAD_OUT",
    "CLEANING",
  ]),
  supervisorName: z.string().optional(),
  forkliftCount: z.string().optional(),
  dailyWorkerCount: z.string().optional(),
});

// One save updates every applicable field for a single department at once
// (supervisor name + forklift/daily worker counts, whichever the department
// actually calls for) rather than one department+role cell at a time -- a
// real area's whole staffing is naturally entered together. A blank field
// deletes any existing row for that role, so the table above always
// reflects current ground truth rather than accumulating stale zeros.
export async function updateDepartmentLabourEntryAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const parsed = departmentLabourEntrySchema.safeParse({
    department: formData.get("department"),
    supervisorName: formData.get("supervisorName") || undefined,
    forkliftCount: formData.get("forkliftCount") || undefined,
    dailyWorkerCount: formData.get("dailyWorkerCount") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { department } = parsed.data;
  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const applicableRoles = LABOUR_ROLE_MATRIX[department];
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  let headcountError: string | null = null;

  const queueRole = (role: (typeof applicableRoles)[number], rawValue: string | undefined) => {
    if (!applicableRoles.includes(role)) return;
    const value = rawValue?.trim() ?? "";
    const uniqueWhere = {
      factoryId_date_shiftType_department_role: { factoryId, date: parsedDate, shiftType, department, role },
    };

    if (!value) {
      ops.push(prisma.dailyLabourEntry.deleteMany({ where: { factoryId, date: parsedDate, shiftType, department, role } }));
      return;
    }
    if (isNameBasedRole(role)) {
      ops.push(
        prisma.dailyLabourEntry.upsert({
          where: uniqueWhere,
          create: { factoryId, date: parsedDate, shiftType, department, role, supervisorName: value },
          update: { supervisorName: value, headcount: null },
        })
      );
      return;
    }
    const headcount = Number(value);
    if (!Number.isFinite(headcount) || headcount < 0) {
      headcountError = "Headcount must be a non-negative number.";
      return;
    }
    ops.push(
      prisma.dailyLabourEntry.upsert({
        where: uniqueWhere,
        create: { factoryId, date: parsedDate, shiftType, department, role, headcount },
        update: { headcount, supervisorName: null },
      })
    );
  };

  queueRole("SUPERVISOR", parsed.data.supervisorName);
  queueRole("FORKLIFT_DRIVER", parsed.data.forkliftCount);
  queueRole("DAILY_WORKER", parsed.data.dailyWorkerCount);

  if (headcountError) return headcountError;

  await prisma.$transaction(ops);

  // Log Shift doesn't ask for a worker count -- it's expected to come from
  // here, this shift's real Labour Distribution total, once Daily Report is
  // filled in (same reasoning as end time / updateLineEfficiencyAction
  // above). Keeps the ShiftLog row in sync with the latest total every time
  // this department's entry changes, rather than only filling it once.
  const shift = await prisma.shiftLog.findFirst({ where: { factoryId, date: parsedDate, shiftType } });
  if (shift) {
    const totals = await prisma.dailyLabourEntry.aggregate({
      where: { factoryId, date: parsedDate, shiftType },
      _sum: { headcount: true },
    });
    await prisma.shiftLog.update({
      where: { id: shift.id },
      data: { workerCount: totals._sum.headcount ?? null },
    });
    revalidatePath("/shifts");
    revalidatePath(`/shifts/${shift.id}`);
  }

  revalidatePath("/daily-report");
  return "ok";
}
