"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const wasteDisposalSchema = z.object({
  factoryId: z.string().min(1),
  date: z.string().min(1),
  supervisorName: z.string().min(1),
  disposalMethod: z.string().min(1),
  location: z.string().optional(),
  classification: z.enum(["HAZARDOUS", "ORGANIC", "OTHER"]),
  notes: z.string().optional(),
});

export async function addWasteDisposalAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "Not signed in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = wasteDisposalSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const date = parseLocalDateOnly(parsed.data.date);
  if (!date) return "That date couldn't be read.";

  const { date: _date, ...data } = parsed.data;

  const created = await prisma.wasteDisposalRecord.create({
    data: {
      ...data,
      date,
      recordedByUserId: session.user.id,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "WASTE_DISPOSAL_LOGGED",
    entityType: "WasteDisposalRecord",
    entityId: created.id,
    detail: `${parsed.data.disposalMethod} — ${parsed.data.classification}`,
  });

  revalidatePath("/waste");
  return "ok";
}
