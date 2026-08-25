"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ackSchema = z.object({
  role: z.enum([
    "COLD_STORAGE_LOADING",
    "RAW_MATERIAL_FEED",
    "GENERAL_ALL_SUPERVISORS",
    "OPERATIONS_MANAGER",
    "LINE_SORTING",
    "HEALTH_AND_SAFETY",
    "FACTORY_MANAGER",
    "RECEIVING",
    "PACKING",
  ]),
  attendeeName: z.string().min(1),
  jobTitle: z.string().optional(),
  acknowledgedDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function addProtocolAcknowledgmentAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = ackSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { acknowledgedDate, ...rest } = parsed.data;

  await prisma.protocolAcknowledgment.create({
    data: {
      ...rest,
      acknowledgedDate: new Date(acknowledgedDate),
      recordedByUserId: session.user.id,
    },
  });

  revalidatePath("/supervisor-roles");
  return "ok";
}
