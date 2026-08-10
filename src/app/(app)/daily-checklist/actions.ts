"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction } from "@/lib/roles";
import { findDailyChecklistSection } from "@/lib/dailyChecklist";

// One save per section, all its items at once -- same batch-save shape as
// Cleaning Mode's per-role score entry. A plain re-editable score, not a
// sign-off: no lock, no distinct-person rule, just the Head of Production's
// routine walkthrough numbers.
export async function updateDailyChecklistSectionScoresAction(
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  sectionKey: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!canSignAsHeadOfProduction(session?.user)) {
    return "Only the Owner or Head of Production can score this checklist.";
  }

  const section = findDailyChecklistSection(sectionKey);
  if (!section) return "Invalid input.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const scoredByName = session!.user.name || session!.user.email;
  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const item of section.items) {
    const raw = formData.get(`score_${item.key}`);
    const trimmed = typeof raw === "string" ? raw.trim() : "";
    const uniqueWhere = {
      factoryId_date_shiftType_itemKey: { factoryId, date: parsedDate, shiftType, itemKey: item.key },
    };

    if (!trimmed) {
      ops.push(
        prisma.dailyProductionChecklistScore.deleteMany({ where: { factoryId, date: parsedDate, shiftType, itemKey: item.key } })
      );
      continue;
    }

    const score = Number(trimmed);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return `Score for "${item.text}" must be a whole number from 0 to 10.`;
    }

    ops.push(
      prisma.dailyProductionChecklistScore.upsert({
        where: uniqueWhere,
        create: { factoryId, date: parsedDate, shiftType, itemKey: item.key, score, scoredByName, scoredByUserId: session!.user.id },
        update: { score, scoredByName, scoredByUserId: session!.user.id, scoredAt: new Date() },
      })
    );
  }

  await prisma.$transaction(ops);
  revalidatePath("/daily-checklist");
  return "ok";
}
