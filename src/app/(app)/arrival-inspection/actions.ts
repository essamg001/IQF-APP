"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";
import { checkQualityLimits, encodeActionResult } from "@/lib/qualityLimits";
import { raiseQualityLimitAlert } from "@/lib/alerts";

const pct = () => z.coerce.number().min(0).max(100).optional();

const arrivalCheckSchema = z
  .object({
    appliesToWholeDelivery: z.boolean(),
    decision: z.enum(["ACCEPTED", "REJECTED"]),

    shiftNumber: z.string().optional(),
    rawMaterialSource: z.string().optional(),
    farmCode: z.string().optional(),
    decapPackHouse: z.string().optional(),
    decapQcApprover: z.string().optional(),
    transportVehicleNo: z.string().optional(),
    receiptNoteNo: z.string().optional(),
    varietyName: z.string().optional(),

    sampleNo: z.string().optional(),
    numberOfBoxesReceived: z.coerce.number().int().optional(),
    sampleCollectionTime: z.string().optional(),
    sampleWeightKg: z.coerce.number().optional(),
    productTemperatureC: z.coerce.number().optional(),
    acidityPh: z.coerce.number().optional(),

    crateWeightKg: z.coerce.number().optional(),
    sizeCaliber: z.string().optional(),
    brix: z.coerce.number().min(0).max(30).optional(),
    fruitColorPct: pct(),
    internalQualityPct: pct(),
    foreignOdor: z.string().optional(),
    foreignTaste: z.string().optional(),

    incompleteMaturityPct: pct(),
    moldSignsPct: pct(),
    mouldPct: pct(),
    capsuleRemainsPct: pct(),
    birdFoodPct: pct(),
    overmaturePct: pct(),
    skinDamagePct: pct(),
    shapeDeformitiesPct: pct(),
    seedClusteringPct: pct(),
    bruisesPct: pct(),
    dryCavitiesPct: pct(),
    overDecappingPct: pct(),
    oxidationPct: pct(),
    sandDustPct: pct(),
    insectsLarvaePct: pct(),
    foreignBodiesPct: pct(),
    leafStemRemainsCount: z.coerce.number().min(0).optional(),
    brokenUncleanPalletsPct: pct(),
    unfumigatedPalletsPct: pct(),
    brokenUncleanCratesPct: pct(),

    notes: z.string().optional(),
  })
  .refine((data) => data.appliesToWholeDelivery || data.sampleNo, {
    message: "Sample/pallet reference is required unless this is a whole-delivery rejection.",
    path: ["sampleNo"],
  })
  .refine((data) => data.appliesToWholeDelivery || data.brix !== undefined, {
    message: "Brix is required unless this is a whole-delivery rejection.",
    path: ["brix"],
  });

const DEFECT_PCT_FIELDS = [
  "incompleteMaturityPct",
  "moldSignsPct",
  "mouldPct",
  "capsuleRemainsPct",
  "birdFoodPct",
  "overmaturePct",
  "skinDamagePct",
  "shapeDeformitiesPct",
  "seedClusteringPct",
  "bruisesPct",
  "dryCavitiesPct",
  "overDecappingPct",
  "oxidationPct",
  "sandDustPct",
  "insectsLarvaePct",
  "foreignBodiesPct",
  "brokenUncleanPalletsPct",
  "unfumigatedPalletsPct",
  "brokenUncleanCratesPct",
] as const;

export async function createArrivalCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = arrivalCheckSchema.safeParse({
    ...raw,
    appliesToWholeDelivery: formData.get("appliesToWholeDelivery") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const session = await auth();
  const { sampleCollectionTime, notes, ...data } = parsed.data;

  const totalDefectsPct = DEFECT_PCT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "RAW_MATERIAL",
      lotId: null,
      decision: data.decision,
      appliesToWholeDelivery: data.appliesToWholeDelivery,
      shiftNumber: data.shiftNumber,
      // We certify to a single standard, so this is stamped automatically
      // rather than asked on every fast-entry submission.
      complianceLevel: "GLOBALGAP",
      rawMaterialSource: data.rawMaterialSource,
      farmCode: data.farmCode,
      decapPackHouse: data.decapPackHouse,
      decapQcApprover: data.decapQcApprover,
      transportVehicleNo: data.transportVehicleNo,
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      sampleNo: data.sampleNo,
      numberOfBoxesReceived: data.numberOfBoxesReceived,
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      sampleWeightKg: data.sampleWeightKg,
      productTemperatureC: data.productTemperatureC,
      acidityPh: data.acidityPh,
      crateWeightKg: data.crateWeightKg,
      sizeCaliber: data.sizeCaliber,
      brix: data.brix ?? 0,
      fruitColorPct: data.fruitColorPct ?? 0,
      internalQualityPct: data.internalQualityPct ?? 0,
      foreignOdor: data.foreignOdor,
      foreignTaste: data.foreignTaste,
      incompleteMaturityPct: data.incompleteMaturityPct,
      moldSignsPct: data.moldSignsPct,
      mouldPct: data.mouldPct ?? 0,
      capsuleRemainsPct: data.capsuleRemainsPct,
      birdFoodPct: data.birdFoodPct,
      overmaturePct: data.overmaturePct,
      skinDamagePct: data.skinDamagePct ?? 0,
      shapeDeformitiesPct: data.shapeDeformitiesPct,
      seedClusteringPct: data.seedClusteringPct,
      bruisesPct: data.bruisesPct,
      dryCavitiesPct: data.dryCavitiesPct,
      overDecappingPct: data.overDecappingPct,
      oxidationPct: data.oxidationPct,
      sandDustPct: data.sandDustPct,
      insectsLarvaePct: data.insectsLarvaePct,
      foreignBodiesPct: data.foreignBodiesPct,
      leafStemRemainsCount: data.leafStemRemainsCount,
      brokenUncleanPalletsPct: data.brokenUncleanPalletsPct,
      unfumigatedPalletsPct: data.unfumigatedPalletsPct,
      brokenUncleanCratesPct: data.brokenUncleanCratesPct,
      totalDefectsPct: data.appliesToWholeDelivery ? undefined : totalDefectsPct,
      notes,
      inspectorId: session?.user.id,
    },
  });

  // A whole-delivery rejection skips per-defect sampling entirely, so there's
  // no measured values to check against a limit. Otherwise, checked against
  // the parsed form values, not the saved row -- fields left blank get
  // defaulted to 0 in the DB, which would otherwise misread as a genuine
  // (and always-failing) 0% reading for min-style limits like Fruit Colour.
  const violations = data.appliesToWholeDelivery
    ? []
    : checkQualityLimits("RAW_MATERIAL", { ...data, totalDefectsPct });
  await raiseQualityLimitAlert({
    checkId: created.id,
    checkpointLabel: "Arrival Inspection at Factory",
    identifier: created.appliesToWholeDelivery
      ? `Receipt ${created.receiptNoteNo ?? "—"} (whole delivery)`
      : `Sample ${created.sampleNo}`,
    violations,
  });

  revalidatePath("/arrival-inspection");
  return encodeActionResult(created.id, violations);
}
