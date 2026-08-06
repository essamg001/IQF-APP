"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";
import { checkQualityLimits, encodeActionResult } from "@/lib/qualityLimits";
import { raiseQualityLimitAlert } from "@/lib/alerts";
import { DECAP_SHARED_DEFECT_FIELDS } from "@/lib/defectFields";
import { egyptDayStart } from "@/lib/timezone";

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

  const totalDefectsPct = DECAP_SHARED_DEFECT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  // Catches the paper-form error mode of relabeling and re-entering the same
  // physical sample twice -- scoped to today only, since sample numbering
  // legitimately restarts day to day. Whole-delivery rejections have no
  // sample number, so they're exempt.
  if (data.sampleNo) {
    const todayStart = egyptDayStart(new Date());
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const duplicate = await prisma.qualityCheck.findFirst({
      where: { checkpoint: "RAW_MATERIAL", sampleNo: data.sampleNo, createdAt: { gte: todayStart, lt: tomorrowStart } },
    });
    if (duplicate) {
      return `Sample No. "${data.sampleNo}" was already logged today for Arrival Inspection — check for a duplicate entry.`;
    }
  }

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
      fruitColorPct: data.fruitColorPct,
      internalQualityPct: data.internalQualityPct,
      foreignOdor: data.foreignOdor,
      foreignTaste: data.foreignTaste,
      incompleteMaturityPct: data.incompleteMaturityPct,
      moldSignsPct: data.moldSignsPct,
      mouldPct: data.mouldPct,
      capsuleRemainsPct: data.capsuleRemainsPct,
      birdFoodPct: data.birdFoodPct,
      overmaturePct: data.overmaturePct,
      skinDamagePct: data.skinDamagePct,
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
  // no measured values to check against a limit.
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
