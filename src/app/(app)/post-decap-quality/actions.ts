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

const postDecapCheckSchema = z.object({
  // Extra, beyond STR03107 itself -- for field traceability (see Pre-Decap Arrivals).
  fieldName: z.string().optional(),
  receiptNoteNo: z.string().optional(),

  varietyName: z.string().optional(),
  clientName: z.string().optional(),
  processingLine: z.string().optional(),
  decapQcApprover: z.string().regex(QC_NUMBER_REGEX, "QC number must be between QC1 and QC51."),

  sampleNo: z.string().min(1),
  sampleCollectionTime: z.string().optional(),
  crateWeightKg: z.coerce.number().optional(),
  sizeCaliber: z.string().optional(),

  brix: z.coerce.number().min(0).max(30),
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

  decision: z.enum(["ACCEPTED", "REJECTED"]),
  divertedTo: z.string().optional(),
  retrainingRequested: z.boolean(),
  notes: z.string().optional(),
});


export async function createPostDecapCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = postDecapCheckSchema.safeParse({
    ...raw,
    retrainingRequested: formData.get("retrainingRequested") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  let fieldId: string | undefined;
  if (parsed.data.fieldName) {
    const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName.trim() } });
    if (!field) return `Field "${parsed.data.fieldName}" not found — check the name and try again.`;
    fieldId = field.id;
  }

  const session = await auth();
  const { fieldName, sampleCollectionTime, notes, ...data } = parsed.data;

  const totalDefectsPct = DECAP_SHARED_DEFECT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  // Catches the paper-form error mode of relabeling and re-entering the same
  // physical sample twice -- scoped to today only, since sample numbering
  // legitimately restarts day to day.
  const todayStart = egyptDayStart(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const duplicate = await prisma.qualityCheck.findFirst({
    where: { checkpoint: "POST_DECAP", sampleNo: data.sampleNo, createdAt: { gte: todayStart, lt: tomorrowStart } },
  });
  if (duplicate) {
    return `Sample No. "${data.sampleNo}" was already logged today for Post-Decap Quality — check for a duplicate entry.`;
  }

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "POST_DECAP",
      lotId: null,
      fieldId,
      decision: data.decision,
      complianceLevel: "GLOBALGAP",
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      clientName: data.clientName,
      processingLine: data.processingLine,
      decapQcApprover: data.decapQcApprover,
      sampleNo: data.sampleNo,
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      crateWeightKg: data.crateWeightKg,
      sizeCaliber: data.sizeCaliber,
      brix: data.brix,
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
      totalDefectsPct,
      divertedTo: data.divertedTo,
      retrainingRequested: data.retrainingRequested,
      notes,
      inspectorId: session?.user.id,
    },
  });

  const violations = checkQualityLimits("POST_DECAP", { ...data, totalDefectsPct });
  await raiseQualityLimitAlert({
    checkId: created.id,
    checkpointLabel: "Post-Decap Quality",
    identifier: `Sample ${created.sampleNo} (QC ${created.decapQcApprover})`,
    violations,
  });

  revalidatePath("/post-decap-quality");
  return encodeActionResult(created.id, violations);
}
