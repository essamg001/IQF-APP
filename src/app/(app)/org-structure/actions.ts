"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const positionSchema = z.object({
  title: z.string().min(1),
  department: z.string().optional(),
  reportsToId: z.string().optional(),
  headcount: z.coerce.number().int().min(0),
  personName: z.string().optional(),
  notes: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

async function requireOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") return null;
  return session;
}

export async function createOrgPositionAction(_prevState: string | undefined, formData: FormData) {
  const session = await requireOwner();
  if (!session) return "You don't have permission to do this.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = positionSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  await prisma.orgPosition.create({ data: parsed.data });

  revalidatePath("/org-structure");
  redirect("/org-structure");
}

export async function updateOrgPositionAction(
  positionId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await requireOwner();
  if (!session) return "You don't have permission to do this.";

  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  const parsed = positionSchema.safeParse(raw);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  if (parsed.data.reportsToId === positionId) return "A position cannot report to itself.";

  await prisma.orgPosition.update({ where: { id: positionId }, data: parsed.data });

  revalidatePath("/org-structure");
  redirect("/org-structure");
}

export async function deleteOrgPositionAction(positionId: string) {
  const session = await requireOwner();
  if (!session) return;

  await prisma.orgPosition.updateMany({ where: { reportsToId: positionId }, data: { reportsToId: null } });
  await prisma.orgPosition.delete({ where: { id: positionId } });

  revalidatePath("/org-structure");
}
