"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";

const pct = () => z.coerce.number().min(0).max(100).optional();

const postDecapCheckSchema = z.object({
  fieldName: z.string().min(1, "Field is required."),
  receiptNoteNo: z.string().optional(),
  shiftNumber: z.string().optional(),
  transportVehicleNo: z.string().optional(),
  varietyName: z.string().optional(),

  sampleNo: z.string().min(1),
  sampleCollectionTime: z.string().optional(),
  sampleWeightKg: z.coerce.number().optional(),
  productTemperatureC: z.coerce.number().optional(),
  acidityPh: z.coerce.number().optional(),

  sizeCaliber: z.string().optional(),
  brix: z.coerce.number().min(0).max(30).optional(),
  fruitColorPct: pct(),
  internalQualityPct: pct(),
  foreignOdor: z.string().optional(),
  foreignTaste: z.string().optional(),

  residualCalyxPct: pct(),
  decappingDamagePct: pct(),
  mouldPct: pct(),
  skinDamagePct: pct(),
  overmaturePct: pct(),
  oxidationPct: pct(),
  insectsLarvaePct: pct(),
  foreignBodiesPct: pct(),

  decision: z.enum(["ACCEPTED", "REJECTED"]),
  notes: z.string().optional(),
});

const DEFECT_PCT_FIELDS = [
  "residualCalyxPct",
  "decappingDamagePct",
  "mouldPct",
  "skinDamagePct",
  "overmaturePct",
  "oxidationPct",
  "insectsLarvaePct",
  "foreignBodiesPct",
] as const;

export async function createPostDecapCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = postDecapCheckSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName.trim() } });
  if (!field) return `Field "${parsed.data.fieldName}" not found — check the name and try again.`;

  const session = await auth();
  const { fieldName, sampleCollectionTime, notes, ...data } = parsed.data;

  const totalDefectsPct = DEFECT_PCT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "POST_DECAP",
      lotId: null,
      fieldId: field.id,
      decision: data.decision,
      shiftNumber: data.shiftNumber,
      complianceLevel: "GLOBALGAP",
      transportVehicleNo: data.transportVehicleNo,
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      sampleNo: data.sampleNo,
      sampleCollectionTime: parseDateSafe(sampleCollectionTime),
      sampleWeightKg: data.sampleWeightKg,
      productTemperatureC: data.productTemperatureC,
      acidityPh: data.acidityPh,
      sizeCaliber: data.sizeCaliber,
      brix: data.brix ?? 0,
      fruitColorPct: data.fruitColorPct ?? 0,
      internalQualityPct: data.internalQualityPct ?? 0,
      foreignOdor: data.foreignOdor,
      foreignTaste: data.foreignTaste,
      residualCalyxPct: data.residualCalyxPct,
      decappingDamagePct: data.decappingDamagePct,
      mouldPct: data.mouldPct ?? 0,
      skinDamagePct: data.skinDamagePct ?? 0,
      overmaturePct: data.overmaturePct,
      oxidationPct: data.oxidationPct,
      insectsLarvaePct: data.insectsLarvaePct,
      foreignBodiesPct: data.foreignBodiesPct,
      totalDefectsPct,
      notes,
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/post-decap-quality");
  return `ok:${created.id}`;
}
