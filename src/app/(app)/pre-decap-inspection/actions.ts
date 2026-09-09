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

const complianceLevels = ["GLOBALGAP", "SPRING", "LEAF", "OTHER", "NURTURE", "AH_DL_GROW", "FAIRTRADE", "ORGANIC_100", "BIO_SUISSE"] as const;

const preDecapCheckSchema = z.object({
  plotLineId: z.string().min(1, "Attach a harvest ticket -- enter its serial number and select the plot line that was sampled."),
  receiptNoteNo: z.string().optional(),
  varietyName: z.string().optional(),
  harvestSupervisor: z.string().optional(),
  complianceLevel: z.enum(complianceLevels).optional(),
  complianceOther: z.string().optional(),

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

  notes: z.string().optional(),
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

  const plotLine = await prisma.harvestTicketPlotLine.findUnique({
    where: { id: parsed.data.plotLineId },
    include: { field: true, harvestTicket: true },
  });
  if (!plotLine) return "Selected plot could not be found — please re-select it.";
  if (!plotLine.fieldId) {
    const plotDesc = [plotLine.stationNo, plotLine.plotValveGhNo].filter(Boolean).join(" · ") || plotLine.id;
    return `This plot line (${plotDesc}) never matched a Field record, so this check can't be tied to a field -- pick a different plot line from the harvest ticket.`;
  }
  const fieldId = plotLine.fieldId;
  const fieldLabel = plotLine.field!.name;

  const sampleCollectedAt = parseDateSafe(parsed.data.sampleCollectionTime);
  if (sampleCollectedAt && plotLine.harvestTicket.receivedAt && sampleCollectedAt < plotLine.harvestTicket.receivedAt) {
    return `Sample Collection Time can't be before the harvest ticket's arrival time (${plotLine.harvestTicket.receivedAt.toLocaleString()}).`;
  }

  const session = await auth();
  const { plotLineId, sampleCollectionTime, notes, ...data } = parsed.data;

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

  // Decision is computed, never picked by the supervisor -- see checkQualityLimits.
  const violations = checkQualityLimits("PRE_DECAP", { ...data, totalDefectsPct });
  const decision: "ACCEPTED" | "REJECTED" = violations.length === 0 ? "ACCEPTED" : "REJECTED";

  const created = await prisma.qualityCheck.create({
    data: {
      checkpoint: "PRE_DECAP",
      lotId: null,
      fieldId,
      harvestTicketPlotLineId: plotLineId,
      decision,
      complianceLevel: data.complianceLevel,
      complianceOther: data.complianceOther,
      receiptNoteNo: data.receiptNoteNo,
      varietyName: data.varietyName,
      harvestSupervisor: data.harvestSupervisor,
      sampleNo: data.sampleNo,
      numberOfBoxesReceived: data.numberOfBoxesReceived,
      sampleCollectionTime: sampleCollectedAt,
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
  return encodeActionResult(created.id, decision, violations);
}
