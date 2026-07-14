"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const pct = () => z.coerce.number().min(0).max(100).optional();

const postFreezeSchema = z.object({
  lotId: z.string().min(1),
  palletId: z.string().optional(),
  decision: z.enum(["ACCEPTED", "REJECTED"]),

  clientName: z.string().optional(),
  traceabilityCode: z.string().optional(),
  varietyName: z.string().optional(),
  operationDate: z.string().optional(),
  expiryDate: z.string().optional(),
  acidityPh: z.coerce.number().optional(),
  complianceLevel: z.enum(["GLOBALGAP", "SPRING", "LEAF", "OTHER"]).optional(),
  complianceOther: z.string().optional(),
  shiftNumber: z.string().optional(),

  sampleCollectionTime: z.string().optional(),
  sampleWeightKg: z.coerce.number().optional(),
  cartonWeightKg: z.coerce.number().optional(),
  productTemperatureC: z.coerce.number().optional(),
  packageClosureOk: z.boolean().optional(),
  dataLabelReviewOk: z.boolean().optional(),
  fruitDiameterUncalibrated: z.string().optional(),
  fruitDiameterCalibratedRegular: z.string().optional(),
  fruitDiameterCalibratedIrregular: z.string().optional(),
  fruitDiameterCalibratedSmall: z.string().optional(),
  brix: z.coerce.number().min(0).max(30),
  fruitColorPct: pct(),
  internalQualityPct: pct(),
  foreignOdor: z.string().optional(),
  foreignTaste: z.string().optional(),
  fullPallet: z.boolean().optional(),

  overmaturePct: pct(),
  incompleteMaturityPct: pct(),
  capsuleRemainsCount: z.coerce.number().min(0).optional(),
  leafRemainsCount: z.coerce.number().min(0).optional(),
  stemFragmentsCount: z.coerce.number().min(0).optional(),
  shapeDeformitiesPct: pct(),
  skinDamagePct: pct(),
  cohesiveClustersPct: pct(),
  crushedBrokenFruitPct: pct(),
  dryBruisesPct: pct(),
  mechanicalFactorsPct: pct(),
  oxidationPct: pct(),
  fungalInfectionPct: pct(),
  insectsLarvaePct: pct(),
  insectInfestationPct: pct(),
  foreignBodiesPct: pct(),
  frozenProductWaitMinutes: z.coerce.number().optional(),

  notes: z.string().optional(),
});

const DEFECT_PCT_FIELDS = [
  "overmaturePct",
  "incompleteMaturityPct",
  "shapeDeformitiesPct",
  "skinDamagePct",
  "cohesiveClustersPct",
  "crushedBrokenFruitPct",
  "dryBruisesPct",
  "mechanicalFactorsPct",
  "oxidationPct",
  "fungalInfectionPct",
  "insectsLarvaePct",
  "insectInfestationPct",
  "foreignBodiesPct",
] as const;

export async function createPostFreezeCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = postFreezeSchema.safeParse({
    ...raw,
    fullPallet: formData.get("fullPallet") === "on",
    packageClosureOk: formData.get("packageClosureOk") === "on",
    dataLabelReviewOk: formData.get("dataLabelReviewOk") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const session = await auth();
  const { operationDate, expiryDate, sampleCollectionTime, ...data } = parsed.data;

  const totalDefectsPct = DEFECT_PCT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  const created = await prisma.qualityCheck.create({
    data: {
      ...data,
      checkpoint: "POST_PACKAGING",
      operationDate: operationDate ? new Date(operationDate) : undefined,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      sampleCollectionTime: sampleCollectionTime ? new Date(sampleCollectionTime) : undefined,
      totalDefectsPct,
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/post-freeze-inspection");
  return `ok:${created.id}`;
}
