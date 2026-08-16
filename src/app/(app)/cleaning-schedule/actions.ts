"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly, toDateOnlyString } from "@/lib/dates";
import { findCleaningTask } from "@/lib/masterCleaningSchedule";
import { logActivity } from "@/lib/activityLog";

export async function toggleMasterCleaningTaskAction(formData: FormData) {
  const factoryId = formData.get("factoryId");
  const dateStr = formData.get("date");
  const taskKey = formData.get("taskKey");
  const checked = formData.get("checked") === "true";
  if (typeof factoryId !== "string" || typeof dateStr !== "string" || typeof taskKey !== "string") return;
  const found = findCleaningTask(taskKey);
  if (!found) return;

  const date = parseLocalDateOnly(dateStr);
  if (!date) return;

  const session = await auth();
  if (!session?.user) return;

  if (checked) {
    await prisma.masterCleaningTaskLog.upsert({
      where: { factoryId_date_taskKey: { factoryId, date, taskKey } },
      update: { completed: true, completedByName: session.user.name ?? session.user.email, completedByUserId: session.user.id, completedAt: new Date() },
      create: {
        factoryId,
        date,
        taskKey,
        completed: true,
        completedByName: session.user.name ?? session.user.email,
        completedByUserId: session.user.id,
      },
    });
  } else {
    await prisma.masterCleaningTaskLog.deleteMany({ where: { factoryId, date, taskKey } });
  }

  await logActivity({
    actorId: session.user.id,
    action: checked ? "CLEANING_SCHEDULE_TASK_COMPLETED" : "CLEANING_SCHEDULE_TASK_UNCHECKED",
    entityType: "MasterCleaningTaskLog",
    entityId: `${factoryId}:${toDateOnlyString(date)}:${taskKey}`,
    detail: `${found.zone.title} — ${found.task.item}`,
  });

  revalidatePath("/cleaning-schedule");
}
