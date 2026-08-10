"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly } from "@/lib/dates";
import { logActivity } from "@/lib/activityLog";
import { canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";
import { CLEANING_AREAS, CLEANING_AREA_LABEL, isCleaningLocked } from "@/lib/cleaning";
import { z } from "zod";

async function getRecord(factoryId: string, parsedDate: Date, shiftType: "DAY" | "NIGHT") {
  return prisma.cleaningShiftRecord.findUnique({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
  });
}

const scoresSchema = z.object({
  scoringRole: z.enum(["PRODUCTION", "MAINTENANCE"]),
});

// One save writes this head's score for every area at once -- each of the
// two responsible people scores independently, so the acting role here is
// checked against who's actually logged in, not a value the form could claim.
export async function updateCleaningScoresAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const parsed = scoresSchema.safeParse({ scoringRole: formData.get("scoringRole") });
  if (!parsed.success) return "Invalid input.";
  const { scoringRole } = parsed.data;

  const session = await auth();
  if (scoringRole === "PRODUCTION" && !canSignAsHeadOfProduction(session?.user)) {
    return "Only the Owner or Head of Production can enter production scores.";
  }
  if (scoringRole === "MAINTENANCE" && !canSignAsHeadOfMaintenance(session?.user)) {
    return "Only the Owner or Head of Maintenance can enter maintenance scores.";
  }

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const record = await getRecord(factoryId, parsedDate, shiftType);
  if (isCleaningLocked(record)) {
    return "This shift's cleaning record is locked -- both sign-offs are already on file. Reopen it first to make changes.";
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const area of CLEANING_AREAS) {
    const raw = formData.get(`score_${area}`);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    let score: number | null = null;
    if (trimmed) {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0 || n > 10) {
        return `Score for ${CLEANING_AREA_LABEL[area]} must be a whole number from 0 to 10.`;
      }
      score = n;
    }

    const uniqueWhere = { factoryId_date_shiftType_area: { factoryId, date: parsedDate, shiftType, area } };
    if (scoringRole === "PRODUCTION") {
      ops.push(
        prisma.cleaningAreaScore.upsert({
          where: uniqueWhere,
          create: { factoryId, date: parsedDate, shiftType, area, productionScore: score },
          update: { productionScore: score },
        })
      );
    } else {
      ops.push(
        prisma.cleaningAreaScore.upsert({
          where: uniqueWhere,
          create: { factoryId, date: parsedDate, shiftType, area, maintenanceScore: score },
          update: { maintenanceScore: score },
        })
      );
    }
  }

  await prisma.$transaction(ops);
  revalidatePath("/cleaning");
  return "ok";
}

// Foam washer use isn't tied to one specific area or one specific head --
// whoever is present entering scores can flag it, since it's a fact about
// the shift's cleaning round as a whole, not something to attribute to just
// one person.
export async function toggleCleaningFoamAction(factoryId: string, date: string, shiftType: "DAY" | "NIGHT") {
  const session = await auth();
  if (!canSignAsHeadOfProduction(session?.user) && !canSignAsHeadOfMaintenance(session?.user)) return;

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return;

  const record = await getRecord(factoryId, parsedDate, shiftType);
  if (isCleaningLocked(record)) return;

  await prisma.cleaningShiftRecord.upsert({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
    create: { factoryId, date: parsedDate, shiftType, cleanedWithFoam: true },
    update: { cleanedWithFoam: !(record?.cleanedWithFoam ?? false) },
  });

  revalidatePath("/cleaning");
}

const signRoleSchema = z.enum(["PRODUCTION", "MAINTENANCE"]);

// Signing off means "I've reviewed and scored every area" -- refused until
// this person's own score is on file for all seven, and refused if the same
// person already holds the other sign-off, so the two are always genuinely
// two different people.
export async function signCleaningAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  roleRaw: string,
  _prevState: string | undefined,
  _formData: FormData
) {
  const roleParsed = signRoleSchema.safeParse(roleRaw);
  if (!roleParsed.success) return "Invalid input.";
  const role = roleParsed.data;

  const session = await auth();
  if (!session?.user) return "You must be logged in to sign off.";
  if (role === "PRODUCTION" && !canSignAsHeadOfProduction(session.user)) {
    return "Only the Owner or Head of Production can sign off as Head of Production.";
  }
  if (role === "MAINTENANCE" && !canSignAsHeadOfMaintenance(session.user)) {
    return "Only the Owner or Head of Maintenance can sign off as Head of Maintenance.";
  }

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const record = await getRecord(factoryId, parsedDate, shiftType);
  if (role === "PRODUCTION" && record?.productionSignedAt) return "ok";
  if (role === "MAINTENANCE" && record?.maintenanceSignedAt) return "ok";

  if (role === "PRODUCTION" && record?.maintenanceSignedByUserId === session.user.id) {
    return "You've already signed off as Head of Maintenance for this shift -- the two sign-offs must be different people.";
  }
  if (role === "MAINTENANCE" && record?.productionSignedByUserId === session.user.id) {
    return "You've already signed off as Head of Production for this shift -- the two sign-offs must be different people.";
  }

  const scores = await prisma.cleaningAreaScore.findMany({ where: { factoryId, date: parsedDate, shiftType } });
  const missing = CLEANING_AREAS.filter((area) => {
    const row = scores.find((s) => s.area === area);
    return role === "PRODUCTION" ? row?.productionScore == null : row?.maintenanceScore == null;
  });
  if (missing.length > 0) {
    return `Score every area first before signing off -- missing: ${missing.map((a) => CLEANING_AREA_LABEL[a]).join(", ")}.`;
  }

  const name = session.user.name || session.user.email;
  const data =
    role === "PRODUCTION"
      ? { productionSignedByName: name, productionSignedByUserId: session.user.id, productionSignedAt: new Date() }
      : { maintenanceSignedByName: name, maintenanceSignedByUserId: session.user.id, maintenanceSignedAt: new Date() };

  await prisma.cleaningShiftRecord.upsert({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
    create: { factoryId, date: parsedDate, shiftType, ...data },
    update: data,
  });

  await logActivity({
    actorId: session.user.id,
    action: role === "PRODUCTION" ? "CLEANING_PRODUCTION_SIGNED" : "CLEANING_MAINTENANCE_SIGNED",
    entityType: "CleaningShiftRecord",
    entityId: `${factoryId}:${date}:${shiftType}`,
    detail: name,
  });

  revalidatePath("/cleaning");
  return "ok";
}

const reopenCleaningSchema = z.object({
  reason: z.string().min(1, "A reason is required to reopen this shift's cleaning record."),
});

export async function reopenCleaningRecordAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const parsed = reopenCleaningSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const record = await getRecord(factoryId, parsedDate, shiftType);
  if (!isCleaningLocked(record)) return "This shift's cleaning record isn't locked -- there's nothing to reopen.";

  await prisma.cleaningShiftRecord.update({
    where: { factoryId_date_shiftType: { factoryId, date: parsedDate, shiftType } },
    data: {
      productionSignedByName: null,
      productionSignedByUserId: null,
      productionSignedAt: null,
      maintenanceSignedByName: null,
      maintenanceSignedByUserId: null,
      maintenanceSignedAt: null,
      reopenedAt: new Date(),
      reopenedReason: parsed.data.reason,
    },
  });

  const session = await auth();
  await logActivity({
    actorId: session?.user.id,
    action: "CLEANING_RECORD_REOPENED",
    entityType: "CleaningShiftRecord",
    entityId: `${factoryId}:${date}:${shiftType}`,
    detail: `Cleared sign-offs (were: ${record?.productionSignedByName ?? "—"} / ${record?.maintenanceSignedByName ?? "—"}) — ${parsed.data.reason}`,
  });

  revalidatePath("/cleaning");
  return "ok";
}
