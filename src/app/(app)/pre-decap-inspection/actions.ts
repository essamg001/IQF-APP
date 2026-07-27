"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";

const pct = () => z.coerce.number().min(0).max(100).optional();

const preDecapCheckSchema = z.object({
  fieldName: z.string().min(1, "Plot is required."),
  receiptNoteNo: z.string().optional(),
  varietyName: z.string().optional(),
  harvestSupervisor: z.string().optional(),

  sampleNo: z.string().min(1),
  numberOfBoxesReceived: z.coerce.number().int().optional(),
  sampleCollectionTime: z.string().optional(),
  sampleWeightKg: z.coerce.number().optional(),
  productTemperatureC: z.coerce.number().optional(),

  brix: z.coerce.number().min(0).max(30),
  fruitColorPct: pct(),
  internalQualityPct: pct(),

  cleaningGoodCratesOk: z.boolean(),
  overmaturePct: pct(),
  diameterUnder22mmPct: pct(),
  botrytisPct: pct(),
  pestDiseasePct: pct(),
  wormEatenPct: pct(),
  bruisesPct: pct(),
  shapeDeformitiesPct: pct(),
  sandDustPct: pct(),
  foreignBodiesPct: pct(),

  decision: z.enum(["ACCEPTED", "REJECTED"]),
  notes: z.string().optional(),
});

const DEFECT_PCT_FIELDS = [
  "overmaturePct",
  "diameterUnder22mmPct",
  "botrytisPct",
  "pestDiseasePct",
  "wormEatenPct",
  "bruisesPct",
  "shapeDeformitiesPct",
  "sandDustPct",
  "foreignBodiesPct",
] as const;

export async function createPreDecapCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = preDecapCheckSchema.safeParse({
    ...raw,
    cleaningGoodCratesOk: formData.get("cleaningGoodCratesOk") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName.trim() } });
  if (!field) return `Plot "${parsed.data.fieldName}" not found — check the name and try again.`;

  const session = await auth();
  const { fieldName, sampleCollectionTime, notes, ...data } = parsed.data;

  const totalDefectsPct = DEFECT_PCT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "PRE_DECAP",
      lotId: null,
      fieldId: field.id,
      decision: data.decision,
      complianceLevel: "GLOBALGAP",
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      harvestSupervisor: data.harvestSupervisor,
      sampleNo: data.sampleNo,
      numberOfBoxesReceived: data.numberOfBoxesReceived,
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      sampleWeightKg: data.sampleWeightKg,
      productTemperatureC: data.productTemperatureC,
      brix: data.brix,
      fruitColorPct: data.fruitColorPct ?? 0,
      internalQualityPct: data.internalQualityPct ?? 0,
      cleaningGoodCratesOk: data.cleaningGoodCratesOk,
      overmaturePct: data.overmaturePct,
      diameterUnder22mmPct: data.diameterUnder22mmPct,
      botrytisPct: data.botrytisPct,
      pestDiseasePct: data.pestDiseasePct,
      wormEatenPct: data.wormEatenPct,
      bruisesPct: data.bruisesPct,
      shapeDeformitiesPct: data.shapeDeformitiesPct,
      sandDustPct: data.sandDustPct,
      foreignBodiesPct: data.foreignBodiesPct,
      totalDefectsPct,
      notes,
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/pre-decap-inspection");
  return `ok:${created.id}`;
}
