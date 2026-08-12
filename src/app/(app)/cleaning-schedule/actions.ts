"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseLocalDateOnly } from "@/lib/dates";
import { findCleaningTask } from "@/lib/masterCleaningSchedule";

export async function toggleMasterCleaningTaskAction(formData: FormData) {
  const factoryId = formData.get("factoryId");
  const dateStr = formData.get("date");
  const taskKey = formData.get("taskKey");
  const checked = formData.get("checked") === "true";
  if (typeof factoryId !== "string" || typeof dateStr !== "string" || typeof taskKey !== "string") return;
  if (!findCleaningTask(taskKey)) return;

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

  revalidatePath("/cleaning-schedule");
}
