"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";
import { checkQualityLimits, encodeActionResult } from "@/lib/qualityLimits";
import { raiseQualityLimitAlert } from "@/lib/alerts";
import { POST_PACKAGING_DEFECT_FIELDS } from "@/lib/defectFields";

const pct = () => z.coerce.number().min(0).max(100).optional();

const postFreezeSchema = z.object({
  lotNumber: z.string().min(1),
  // A sample is always pulled from a carton on a specific pallet -- the
  // pallet must exist and be sampled before it's transported to cold
  // storage, so this can never be a lot-wide, pallet-less check.
  palletNumber: z.string().min(1, "Pallet number is required."),
  decision: z.enum(["ACCEPTED", "REJECTED"]),

  clientName: z.string().optional(),
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
  fruitDiameterCalibratedSmall: z.string().optional(),
  fruitDiameterCalibratedMedium: z.string().optional(),
  fruitDiameterCalibratedLarge: z.string().optional(),
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

  const lot = await prisma.productionLot.findUnique({ where: { lotNumber: parsed.data.lotNumber.trim() } });
  if (!lot) return `Lot ${parsed.data.lotNumber} not found — check the number and try again.`;

  // The physical pallet is a reusable asset (its number is branded on the
  // base, not generated per lot), so it isn't pre-created anywhere -- this is
  // the first stage that ties a real pallet to this lot's produce. Reuses the
  // record if this exact pallet was already sampled for this lot (e.g. a
  // second carton, or a correction); a completely different lot using the
  // same physical number gets its own separate record, not this one.
  const palletNumberTrimmed = parsed.data.palletNumber.trim();
  const pallet = await prisma.pallet.upsert({
    where: { palletNumber_lotId: { palletNumber: palletNumberTrimmed, lotId: lot.id } },
    update: {},
    create: { palletNumber: palletNumberTrimmed, lotId: lot.id },
  });
  const palletId = pallet.id;

  const session = await auth();
  const { lotNumber, palletNumber, operationDate, expiryDate, sampleCollectionTime, ...data } = parsed.data;

  const totalDefectsPct = POST_PACKAGING_DEFECT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  const created = await prisma.qualityCheck.create({
    data: {
      ...data,
      lotId: lot.id,
      palletId,
      checkpoint: "POST_PACKAGING",
      operationDate: parseDateSafe(operationDate),
      expiryDate: parseDateSafe(expiryDate),
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      totalDefectsPct,
      inspectorId: session?.user.id,
    },
  });

  const violations = checkQualityLimits("POST_PACKAGING", { ...data, totalDefectsPct }, lot.grade);
  await raiseQualityLimitAlert({
    checkId: created.id,
    checkpointLabel: "Post-Freeze Inspection",
    identifier: `Lot ${lot.lotNumber} (Grade ${lot.grade}) — Pallet ${palletNumber}`,
    violations,
  });

  revalidatePath("/post-freeze-inspection");
  return encodeActionResult(created.id, violations);
}
