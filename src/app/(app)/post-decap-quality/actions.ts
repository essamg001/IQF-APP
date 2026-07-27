"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";

const pct = () => z.coerce.number().min(0).max(100).optional();

const postDecapCheckSchema = z.object({
  // Extra, beyond STR03107 itself -- for field traceability (see Pre-Decap Arrivals).
  fieldName: z.string().optional(),
  receiptNoteNo: z.string().optional(),

  varietyName: z.string().optional(),
  clientName: z.string().optional(),
  processingLine: z.string().optional(),

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

  const totalDefectsPct = DEFECT_PCT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

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
      sampleNo: data.sampleNo,
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      crateWeightKg: data.crateWeightKg,
      sizeCaliber: data.sizeCaliber,
      brix: data.brix,
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
      totalDefectsPct,
      divertedTo: data.divertedTo,
      retrainingRequested: data.retrainingRequested,
      notes,
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/post-decap-quality");
  return `ok:${created.id}`;
}
