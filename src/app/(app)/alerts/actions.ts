"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function markAlertReadAction(alertId: string) {
  await prisma.alert.update({ where: { id: alertId }, data: { status: "READ" } });
  revalidatePath("/alerts");
}
