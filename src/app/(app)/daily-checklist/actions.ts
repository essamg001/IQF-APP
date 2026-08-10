"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly } from "@/lib/dates";
import { canSignAsHeadOfProduction } from "@/lib/roles";
import { isValidDailyChecklistItemKey } from "@/lib/dailyChecklist";

// A plain toggle, not a sign-off -- this is the Head of Production's routine
// per-shift walkthrough, freely re-checkable, not a one-time accountability
// gate like Cleaning Mode or the container checklist. Existence of a row
// means confirmed (same shape as ContainerChecklistConfirmation); toggling
// off just deletes it.
export async function toggleDailyChecklistItemAction(factoryId: string, date: string, shiftType: "DAY" | "NIGHT", itemKey: string) {
  const session = await auth();
  if (!canSignAsHeadOfProduction(session?.user)) return;
  if (!isValidDailyChecklistItemKey(itemKey)) return;

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return;

  const existing = await prisma.dailyProductionChecklistConfirmation.findUnique({
    where: { factoryId_date_shiftType_itemKey: { factoryId, date: parsedDate, shiftType, itemKey } },
  });

  if (existing) {
    await prisma.dailyProductionChecklistConfirmation.delete({ where: { id: existing.id } });
  } else {
    await prisma.dailyProductionChecklistConfirmation.create({
      data: {
        factoryId,
        date: parsedDate,
        shiftType,
        itemKey,
        confirmedByUserId: session!.user.id,
        confirmedByName: session!.user.name || session!.user.email,
      },
    });
  }

  revalidatePath("/daily-checklist");
}
