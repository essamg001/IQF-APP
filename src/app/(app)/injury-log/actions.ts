"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const headerSchema = z.object({
  factoryId: z.string().min(1),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000),
  supervisorName: z.string().optional(),
  alternateSupervisorName: z.string().optional(),
  bluePlasterLotNumber: z.string().optional(),
  bluePlasterOpeningBalance: z.coerce.number().int().nonnegative().optional(),
  glovesOpeningBalance: z.coerce.number().int().nonnegative().optional(),
});

export async function updateMonthlyFirstAidSupplyLogAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = headerSchema.safeParse(raw);
  if (!parsed.success) return;

  const { factoryId, month, year, ...rest } = parsed.data;
  await prisma.monthlyFirstAidSupplyLog.upsert({
    where: { factoryId_month_year: { factoryId, month, year } },
    update: rest,
    create: { factoryId, month, year, ...rest },
  });

  revalidatePath("/injury-log");
}

const injurySchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  employeeName: z.string().min(1),
  packingGroupNumber: z.string().optional(),
  injuryDescription: z.string().min(1),
  occurredInWork: z.enum(["true", "false"]),
  sickLeaveDays: z.coerce.number().int().nonnegative().optional(),
  returnToWorkDate: z.string().optional(),
  referredToPhysician: z.string().optional(),
  bluePlasterReleaseTime: z.string().optional(),
  bluePlasterItemsReleased: z.coerce.number().int().nonnegative().optional(),
  glovesReleaseTime: z.string().optional(),
  glovesItemsReleased: z.coerce.number().int().nonnegative().optional(),
  endOfDayConfirmed: z.string().optional(),
  endOfDayConfirmedTime: z.string().optional(),
  correctiveAction: z.string().optional(),
  firstAidSupervisorSignature: z.string().optional(),
});

export async function addInjuryRecordAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to log an injury.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = injurySchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";
  const returnToWorkDate = parsed.data.returnToWorkDate ? parseLocalDateOnly(parsed.data.returnToWorkDate) : null;

  const created = await prisma.injuryRecord.create({
    data: {
      factoryId: parsed.data.factoryId,
      date,
      employeeName: parsed.data.employeeName,
      packingGroupNumber: parsed.data.packingGroupNumber,
      injuryDescription: parsed.data.injuryDescription,
      occurredInWork: parsed.data.occurredInWork === "true",
      sickLeaveDays: parsed.data.sickLeaveDays,
      returnToWorkDate,
      referredToPhysician: parsed.data.referredToPhysician === "on",
      bluePlasterReleaseTime: parsed.data.bluePlasterReleaseTime,
      bluePlasterItemsReleased: parsed.data.bluePlasterItemsReleased,
      glovesReleaseTime: parsed.data.glovesReleaseTime,
      glovesItemsReleased: parsed.data.glovesItemsReleased,
      endOfDayConfirmed: parsed.data.endOfDayConfirmed === "on",
      endOfDayConfirmedTime: parsed.data.endOfDayConfirmedTime,
      correctiveAction: parsed.data.correctiveAction,
      firstAidSupervisorSignature: parsed.data.firstAidSupervisorSignature,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "INJURY_RECORDED",
    entityType: "InjuryRecord",
    entityId: created.id,
    detail: `${parsed.data.employeeName} — ${parsed.data.injuryDescription}`,
  });

  revalidatePath("/injury-log");
  return "ok";
}
