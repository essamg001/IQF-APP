"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessLab } from "@/lib/roles";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const authorizationSchema = z.object({
  name: z.string().min(1),
  job: z.string().optional(),
  location: z.string().optional(),
  allowsMobile: z.boolean(),
  allowsPens: z.boolean(),
  allowsCalculator: z.boolean(),
  allowsOther: z.boolean(),
  otherNote: z.string().optional(),
  notes: z.string().optional(),
});

// Same Owner-or-Quality gate as the Lab page -- this list is what the
// Quality Manager sign-off on the printed HSE03290 form actually means.
export async function addPersonalItemAuthorizationAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canAccessLab(session?.user?.role)) return "Only Quality or the Owner can manage this list.";

  const parsed = authorizationSchema.safeParse({
    name: formData.get("name"),
    job: formData.get("job") || undefined,
    location: formData.get("location") || undefined,
    allowsMobile: formData.get("allowsMobile") === "on",
    allowsPens: formData.get("allowsPens") === "on",
    allowsCalculator: formData.get("allowsCalculator") === "on",
    allowsOther: formData.get("allowsOther") === "on",
    otherNote: formData.get("otherNote") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.personalItemAuthorization.create({ data: parsed.data });

  await logActivity({
    actorId: session!.user.id,
    action: "PERSONAL_ITEM_AUTHORIZATION_ADDED",
    entityType: "PersonalItemAuthorization",
    entityId: created.id,
    detail: parsed.data.name,
  });

  revalidatePath("/personal-items");
  return "ok";
}

export async function toggleAuthorizationActiveAction(id: string) {
  const session = await auth();
  if (!canAccessLab(session?.user?.role)) return;

  const existing = await prisma.personalItemAuthorization.findUniqueOrThrow({ where: { id } });
  await prisma.personalItemAuthorization.update({ where: { id }, data: { isActive: !existing.isActive } });

  await logActivity({
    actorId: session!.user.id,
    action: "PERSONAL_ITEM_AUTHORIZATION_TOGGLED",
    entityType: "PersonalItemAuthorization",
    entityId: id,
    detail: `${existing.name} → ${!existing.isActive ? "active" : "inactive"}`,
  });

  revalidatePath("/personal-items");
}

const conditionEnum = z.enum(["INTACT", "CRACKED", "BROKEN", "LOST"]);

function readCondition(formData: FormData, field: string) {
  const raw = formData.get(field);
  if (!raw) return undefined;
  const parsed = conditionEnum.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export async function checkInPersonalItemsAction(
  authorizationId: string,
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to check someone in.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const existing = await prisma.personalItemShiftCheck.findUnique({
    where: { authorizationId_factoryId_date_shiftType: { authorizationId, factoryId, date: parsedDate, shiftType } },
  });
  if (existing) return "Already checked in for this shift.";

  const created = await prisma.personalItemShiftCheck.create({
    data: {
      authorizationId,
      factoryId,
      date: parsedDate,
      shiftType,
      checkedInByName: session.user.name || session.user.email,
      checkedInByUserId: session.user.id,
      mobileStatusStart: readCondition(formData, "mobileStatusStart"),
      pensStatusStart: readCondition(formData, "pensStatusStart"),
      calculatorStatusStart: readCondition(formData, "calculatorStatusStart"),
      otherStatusStart: readCondition(formData, "otherStatusStart"),
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "PERSONAL_ITEM_CHECKED_IN",
    entityType: "PersonalItemShiftCheck",
    entityId: created.id,
  });

  revalidatePath("/personal-items");
  return "ok";
}

// Only fills a still-open check -- never overwrites an existing check-out,
// same reasoning as ShiftLog.endTime. A Broken/Lost reading here is exactly
// when HSE03291 says to file a GEN03108 non-conformance report -- this
// action doesn't do that automatically, it just records what happened.
export async function checkOutPersonalItemsAction(checkId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to check someone out.";

  const existing = await prisma.personalItemShiftCheck.findUniqueOrThrow({ where: { id: checkId } });
  if (existing.checkedOutAt) return "Already checked out.";

  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const actionTaken = String(formData.get("actionTaken") ?? "").trim() || undefined;

  await prisma.personalItemShiftCheck.update({
    where: { id: checkId },
    data: {
      checkedOutAt: new Date(),
      checkedOutByName: session.user.name || session.user.email,
      checkedOutByUserId: session.user.id,
      mobileStatusEnd: readCondition(formData, "mobileStatusEnd"),
      pensStatusEnd: readCondition(formData, "pensStatusEnd"),
      calculatorStatusEnd: readCondition(formData, "calculatorStatusEnd"),
      otherStatusEnd: readCondition(formData, "otherStatusEnd"),
      actionTaken,
      notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "PERSONAL_ITEM_CHECKED_OUT",
    entityType: "PersonalItemShiftCheck",
    entityId: checkId,
    detail: notes,
  });

  revalidatePath("/personal-items");
  return "ok";
}

const screeningSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  personName: z.string().min(1),
  itemFound: z.string().min(1),
  disposalMethod: z.string().optional(),
  location: z.string().optional(),
  supervisorName: z.string().min(1),
});

// The pre-high-care-area banned-item screening (glass/jewelry/loose
// plastic) -- distinct from the authorized-item check-in/out above (see the
// model's own comment on BannedItemScreeningRecord).
export async function addBannedItemScreeningAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = screeningSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const { date: _date, ...data } = parsed.data;

  const created = await prisma.bannedItemScreeningRecord.create({
    data: {
      ...data,
      date,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "BANNED_ITEM_SCREENING_LOGGED",
    entityType: "BannedItemScreeningRecord",
    entityId: created.id,
    detail: `${parsed.data.personName} — ${parsed.data.itemFound}`,
  });

  revalidatePath("/personal-items");
  return "ok";
}
