"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";
import { raiseToolInventoryDiscrepancyAlert } from "@/lib/alerts";
import { parseLocalDateOnly } from "@/lib/dates";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const itemSchema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int().positive(),
  location: z.string().optional(),
});

export async function addToolInventoryItemAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const created = await prisma.toolInventoryItem.create({ data: parsed.data });

  await logActivity({
    actorId: session.user.id,
    action: "TOOL_INVENTORY_ITEM_ADDED",
    entityType: "ToolInventoryItem",
    entityId: created.id,
    detail: `${parsed.data.name} × ${parsed.data.count}`,
  });

  revalidatePath("/tool-inventory");
  return "ok";
}

export async function toggleToolInventoryItemActiveAction(id: string) {
  const session = await auth();
  if (!session?.user) return;

  const existing = await prisma.toolInventoryItem.findUniqueOrThrow({ where: { id } });
  await prisma.toolInventoryItem.update({ where: { id }, data: { isActive: !existing.isActive } });

  await logActivity({
    actorId: session.user.id,
    action: "TOOL_INVENTORY_ITEM_TOGGLED",
    entityType: "ToolInventoryItem",
    entityId: id,
    detail: `${existing.name} → ${!existing.isActive ? "active" : "inactive"}`,
  });

  revalidatePath("/tool-inventory");
}

export async function checkInToolInventoryAction(
  toolId: string,
  factoryId: string,
  date: string,
  shiftType: "DAY" | "NIGHT",
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to check in.";

  const parsedDate = parseLocalDateOnly(date);
  if (!parsedDate) return "That date couldn't be read.";

  const existing = await prisma.toolInventoryShiftCheck.findUnique({
    where: { toolId_factoryId_date_shiftType: { toolId, factoryId, date: parsedDate, shiftType } },
  });
  if (existing) return "Already checked in for this shift.";

  const startIntactCount = z.coerce.number().int().nonnegative().optional().parse(formData.get("startIntactCount") || undefined);
  const startBrokenCount = z.coerce.number().int().nonnegative().optional().parse(formData.get("startBrokenCount") || undefined);

  const created = await prisma.toolInventoryShiftCheck.create({
    data: {
      toolId,
      factoryId,
      date: parsedDate,
      shiftType,
      checkedInByName: session.user.name || session.user.email,
      checkedInByUserId: session.user.id,
      startIntactCount,
      startBrokenCount,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "TOOL_INVENTORY_CHECKED_IN",
    entityType: "ToolInventoryShiftCheck",
    entityId: created.id,
  });

  revalidatePath("/tool-inventory");
  return "ok";
}

// Only fills a still-open check -- never overwrites an existing check-out,
// same pattern as Personal Items. A checked-out total lower than the tool's
// registered count is exactly the "a piece may be unaccounted for" signal
// this register exists to catch, so it raises the same kind of alert as a
// blade/knife return mismatch rather than silently recording it.
export async function checkOutToolInventoryAction(checkId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user) return "You must be logged in to check out.";

  const existing = await prisma.toolInventoryShiftCheck.findUniqueOrThrow({ where: { id: checkId }, include: { tool: true } });
  if (existing.checkedOutAt) return "Already checked out.";

  const endIntactCount = z.coerce.number().int().nonnegative().optional().parse(formData.get("endIntactCount") || undefined);
  const endBrokenCount = z.coerce.number().int().nonnegative().optional().parse(formData.get("endBrokenCount") || undefined);
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  await prisma.toolInventoryShiftCheck.update({
    where: { id: checkId },
    data: {
      checkedOutAt: new Date(),
      checkedOutByName: session.user.name || session.user.email,
      checkedOutByUserId: session.user.id,
      endIntactCount,
      endBrokenCount,
      notes,
    },
  });

  await logActivity({
    actorId: session.user.id,
    action: "TOOL_INVENTORY_CHECKED_OUT",
    entityType: "ToolInventoryShiftCheck",
    entityId: checkId,
    detail: notes,
  });

  if (endIntactCount != null && endBrokenCount != null) {
    const countedTotal = endIntactCount + endBrokenCount;
    if (countedTotal < existing.tool.count) {
      await raiseToolInventoryDiscrepancyAlert({
        checkId,
        toolName: existing.tool.name,
        registeredCount: existing.tool.count,
        countedTotal,
      });
    }
  }

  revalidatePath("/tool-inventory");
  return "ok";
}
