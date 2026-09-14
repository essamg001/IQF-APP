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
import { QC_NUMBER_REGEX } from "@/lib/qc";

const pct = () => z.coerce.number().min(0).max(100).optional();

const COMPLIANCE_LEVELS = ["GLOBALGAP", "SPRING", "LEAF", "OTHER", "NURTURE", "AH_DL_GROW", "FAIRTRADE", "ORGANIC_100", "BIO_SUISSE"] as const;

// A submitted timestamp can't be earlier than right now -- the whole point is
// stopping a supervisor from backdating an inspection to cover a missed one.
// A couple of minutes of slack absorbs normal clock skew/typing time between
// picking the timestamp and the request actually landing, not a loophole.
const PAST_DATE_GRACE_MS = 2 * 60 * 1000;

const arrivalCheckSchema = z
  .object({
    appliesToWholeDelivery: z.boolean(),

    factoryId: z.string().min(1, "Factory is required."),
    shiftType: z.enum(["DAY", "NIGHT"]),
    shiftNumber: z.string().optional(),
    rawMaterialSource: z.string().optional(),
    farmCode: z.string().optional(),
    decapPackHouse: z.string().optional(),
    decapQcApprover: z.string().regex(QC_NUMBER_REGEX).optional(),
    transportVehicleNo: z.string().optional(),
    receiptNoteNo: z.string().optional(),
    varietyName: z.string().optional(),
    complianceLevels: z.array(z.enum(COMPLIANCE_LEVELS)).optional(),
    complianceOther: z.string().optional(),

    sampleNo: z.string().optional(),
    numberOfBoxesReceived: z.coerce.number().int().optional(),
    numberOfCratesReceived: z.coerce.number().int().optional(),
    palletsCovered: z.coerce.number().int().min(1).optional(),
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
  })
  .refine(
    (data) => {
      if (!data.sampleCollectionTime) return true;
      const parsed = new Date(data.sampleCollectionTime);
      return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= Date.now() - PAST_DATE_GRACE_MS;
    },
    { message: "Sample Collection Time can't be in the past.", path: ["sampleCollectionTime"] }
  );


export async function createArrivalCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = arrivalCheckSchema.safeParse({
    ...raw,
    appliesToWholeDelivery: formData.get("appliesToWholeDelivery") === "on",
    complianceLevels: formData.getAll("complianceLevels"),
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

  // A whole-delivery rejection is the supervisor's own deliberate call (no
  // pallet-by-pallet sampling happens, so there's nothing to compute against
  // thresholds) -- everything else is decided by checkQualityLimits, never
  // picked manually.
  const violations = data.appliesToWholeDelivery
    ? []
    : checkQualityLimits("RAW_MATERIAL", { ...data, totalDefectsPct });
  const decision: "ACCEPTED" | "REJECTED" = data.appliesToWholeDelivery
    ? "REJECTED"
    : violations.length === 0
      ? "ACCEPTED"
      : "REJECTED";

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "RAW_MATERIAL",
      lotId: null,
      decision,
      appliesToWholeDelivery: data.appliesToWholeDelivery,
      factoryId: data.factoryId,
      shiftType: data.shiftType,
      shiftNumber: data.shiftNumber,
      complianceLevels: data.complianceLevels ?? [],
      complianceOther: data.complianceOther,
      rawMaterialSource: data.rawMaterialSource,
      farmCode: data.farmCode,
      decapPackHouse: data.decapPackHouse,
      decapQcApprover: data.decapQcApprover,
      transportVehicleNo: data.transportVehicleNo,
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      sampleNo: data.sampleNo,
      numberOfBoxesReceived: data.numberOfBoxesReceived,
      numberOfCratesReceived: data.numberOfCratesReceived,
      palletsCovered: data.palletsCovered ?? 1,
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

  await raiseQualityLimitAlert({
    checkId: created.id,
    checkpointLabel: "Arrival Inspection at Factory",
    identifier: created.appliesToWholeDelivery
      ? `Receipt ${created.receiptNoteNo ?? "—"} (whole delivery)`
      : `Sample ${created.sampleNo}`,
    violations,
  });

  revalidatePath("/arrival-inspection");
  return encodeActionResult(created.id, decision, violations);
}
