"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const entrySchema = z.object({
  planId: z.string().min(1),
  targetPestOrDisease: z.string().min(1),
  pestStage: z.string().optional(),
  economicInjuryThreshold: z.string().optional(),
  plantGrowthStage: z.string().optional(),
  treatmentMethod: z
    .enum(["SPRAYING", "INJECTION", "DUSTING", "FUMIGATION", "STERILIZATION", "DISTRIBUTION_OF_NATURAL_ENEMIES"])
    .optional(),
  category: z.enum(["BIOLOGICAL", "CHEMICAL", "NATURAL_ENEMIES"]).optional(),
  formulationCode: z.string().optional(),
  activeIngredient: z.string().optional(),
  commercialProductName: z.string().min(1),
  registrationNumber: z.string().optional(),
  manufacturer: z.string().optional(),
  activeIngredientConcentrationPct: z.string().optional(),
  dosePer100L: z.string().optional(),
  waterVolumePerFeddan: z.string().optional(),
  dosePerFeddan: z.string().optional(),
  proposedPhiDays: z.string().optional(),
  reEntryPeriodHours: z.string().optional(),
  applicationTimeWindow: z.string().optional(),
  maxTreatmentsPerSeason: z.string().optional(),
  strictestMrlLimitMgKg: z.string().optional(),
  euArfdMgKg: z.string().optional(),
  fairtradeHazardClass: z.string().optional(),
  isPending: z.boolean(),
  notes: z.string().optional(),
});

function parseForm(formData: FormData) {
  const raw = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v]));
  return entrySchema.safeParse({ ...raw, isPending: formData.get("isPending") === "on" });
}

export async function createCropProtectionEntryAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    return "You don't have permission to do this.";
  }

  const parsed = parseForm(formData);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { planId, ...data } = parsed.data;
  await prisma.cropProtectionEntry.create({ data: { planId, ...data } });

  revalidatePath("/crop-protection-plan");
  redirect("/crop-protection-plan");
}

export async function updateCropProtectionEntryAction(
  entryId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    return "You don't have permission to do this.";
  }

  const parsed = parseForm(formData);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "Invalid input.";

  const { planId, ...data } = parsed.data;
  await prisma.cropProtectionEntry.update({ where: { id: entryId }, data });

  revalidatePath("/crop-protection-plan");
  redirect("/crop-protection-plan");
}

export async function deleteCropProtectionEntryAction(entryId: string) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) return;

  await prisma.cropProtectionEntry.delete({ where: { id: entryId } });
  revalidatePath("/crop-protection-plan");
}
