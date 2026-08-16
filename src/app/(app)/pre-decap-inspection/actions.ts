"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { parseDateSafe } from "@/lib/dates";
import { z } from "zod";
import { checkFieldTrend, checkQualityLimits, encodeActionResult } from "@/lib/qualityLimits";
import { raiseFieldTrendAlert, raiseQualityLimitAlert } from "@/lib/alerts";
import { PRE_DECAP_DEFECT_FIELDS } from "@/lib/defectFields";
import { egyptDayStart } from "@/lib/timezone";

const pct = () => z.coerce.number().min(0).max(100).optional();

const preDecapCheckSchema = z.object({
  fieldName: z.string().optional(),
  plotLineId: z.string().optional(),
  receiptNoteNo: z.string().optional(),
  varietyName: z.string().optional(),
  harvestSupervisor: z.string().optional(),

  sampleNo: z.string().min(1),
  numberOfBoxesReceived: z.coerce.number().int().min(0).optional(),
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
  earlyBotrytisPct: pct(),
  pestDiseasePct: pct(),
  insectDamagePct: pct(),
  wormEatenPct: pct(),
  birdTracesPct: pct(),
  leavesStalksPct: pct(),
  bruisesPct: pct(),
  shapeDeformitiesPct: pct(),
  sandDustPct: pct(),
  foreignBodiesPct: pct(),

  decision: z.enum(["ACCEPTED", "REJECTED"]),
  notes: z.string().optional(),
}).refine((data) => Boolean(data.fieldName?.trim() || data.plotLineId), {
  message: "Select a plot (via Serial Number, or type the Plot Number).",
});


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

  let fieldId: string | null = null;
  let fieldLabel: string;

  if (parsed.data.plotLineId) {
    const plotLine = await prisma.harvestTicketPlotLine.findUnique({
      where: { id: parsed.data.plotLineId },
      include: { field: true },
    });
    if (!plotLine) return "Selected plot could not be found — please re-select it.";
    if (!plotLine.fieldId) {
      const plotDesc = [plotLine.stationNo, plotLine.plotValveGhNo].filter(Boolean).join(" · ") || plotLine.id;
      return `This plot line (${plotDesc}) never matched a Field record, so this check can't be tied to a field -- clear the Serial Number above and type the Plot Number directly instead.`;
    }
    fieldId = plotLine.fieldId;
    fieldLabel = plotLine.field!.name;
  } else {
    const field = await prisma.field.findUnique({ where: { name: parsed.data.fieldName!.trim() } });
    if (!field) return `Plot "${parsed.data.fieldName}" not found — check the name and try again.`;
    fieldId = field.id;
    fieldLabel = field.name;
  }

  const session = await auth();
  const { fieldName, plotLineId, sampleCollectionTime, notes, ...data } = parsed.data;

  const totalDefectsPct = PRE_DECAP_DEFECT_FIELDS.reduce((sum, key) => sum + (data[key] ?? 0), 0);

  // Catches the paper-form error mode of relabeling and re-entering the same
  // physical sample twice -- scoped to today only, since sample numbering
  // legitimately restarts day to day.
  const todayStart = egyptDayStart(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const duplicate = await prisma.qualityCheck.findFirst({
    where: { checkpoint: "PRE_DECAP", sampleNo: data.sampleNo, createdAt: { gte: todayStart, lt: tomorrowStart } },
  });
  if (duplicate) {
    return `Sample No. "${data.sampleNo}" was already logged today for Pre-Decap Arrivals — check for a duplicate entry.`;
  }

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "PRE_DECAP",
      lotId: null,
      fieldId,
      harvestTicketPlotLineId: plotLineId,
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
      fruitColorPct: data.fruitColorPct,
      internalQualityPct: data.internalQualityPct,
      cleaningGoodCratesOk: data.cleaningGoodCratesOk,
      overmaturePct: data.overmaturePct,
      diameterUnder22mmPct: data.diameterUnder22mmPct,
      botrytisPct: data.botrytisPct,
      earlyBotrytisPct: data.earlyBotrytisPct,
      pestDiseasePct: data.pestDiseasePct,
      insectDamagePct: data.insectDamagePct,
      wormEatenPct: data.wormEatenPct,
      birdTracesPct: data.birdTracesPct,
      leavesStalksPct: data.leavesStalksPct,
      bruisesPct: data.bruisesPct,
      shapeDeformitiesPct: data.shapeDeformitiesPct,
      sandDustPct: data.sandDustPct,
      foreignBodiesPct: data.foreignBodiesPct,
      totalDefectsPct,
      notes,
      inspectorId: session?.user.id,
    },
  });

  const violations = checkQualityLimits("PRE_DECAP", { ...data, totalDefectsPct });
  await raiseQualityLimitAlert({
    checkId: created.id,
    checkpointLabel: "Pre-Decap Arrival",
    identifier: `${fieldLabel} (sample ${created.sampleNo})`,
    violations,
  });

  if (fieldId) {
    const recentChecks = await prisma.qualityCheck.findMany({
      where: { checkpoint: "PRE_DECAP", fieldId },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    const trendWarnings = checkFieldTrend(recentChecks.reverse(), "PRE_DECAP");
    await raiseFieldTrendAlert({
      fieldId,
      checkpointLabel: "Pre-Decap Arrival",
      identifier: fieldLabel,
      warnings: trendWarnings,
    });
  }

  revalidatePath("/pre-decap-inspection");
  return encodeActionResult(created.id, violations);
}
