import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { startOfWeek } from "date-fns";
import { formatDate } from "@/lib/dates";
import {
  egyptDateKey,
  egyptDateOnly,
  egyptMonthKey,
  egyptSeasonKey,
  egyptSeasonLabel,
  egyptSeasonStart,
  formatYMD,
  parseDateKey,
} from "@/lib/timezone";
import { FieldQualityTable, type Period, type PeriodSection, type FieldRow, type TicketCheck } from "./field-quality-table";
import type { Field } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

const CHECK_SELECT = {
  id: true,
  fieldId: true,
  createdAt: true,
  decision: true,
  brix: true,
  fruitColorPct: true,
  internalQualityPct: true,
  cleaningGoodCratesOk: true,
  overmaturePct: true,
  diameterUnder22mmPct: true,
  botrytisPct: true,
  pestDiseasePct: true,
  wormEatenPct: true,
  bruisesPct: true,
  shapeDeformitiesPct: true,
  sandDustPct: true,
  foreignBodiesPct: true,
  harvestTicketPlotLine: {
    select: {
      stationNo: true,
      plotValveGhNo: true,
      cutNo: true,
      weightKg: true,
      cratesCount: true,
      harvestTicket: { select: { serialNumber: true, harvestDate: true } },
    },
  },
} as const;

type Check = {
  id: string;
  fieldId: string | null;
  createdAt: Date;
  decision: string | null;
  brix: number;
  fruitColorPct: number | null;
  internalQualityPct: number | null;
  cleaningGoodCratesOk: boolean | null;
  overmaturePct: number | null;
  diameterUnder22mmPct: number | null;
  botrytisPct: number | null;
  pestDiseasePct: number | null;
  wormEatenPct: number | null;
  bruisesPct: number | null;
  shapeDeformitiesPct: number | null;
  sandDustPct: number | null;
  foreignBodiesPct: number | null;
  harvestTicketPlotLine: {
    stationNo: string | null;
    plotValveGhNo: string | null;
    cutNo: string | null;
    weightKg: number | null;
    cratesCount: number | null;
    harvestTicket: { serialNumber: string; harvestDate: Date | null } | null;
  } | null;
};

const SEASON_BUCKET_COUNT = 3;

function aggregate(checks: Check[], key: string, label: string) {
  if (checks.length === 0) return null;
  const avg = (get: (c: Check) => number | null) => {
    const vals = checks.map(get).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const rejected = checks.filter((c) => c.decision === "REJECTED").length;
  const crateChecks = checks.filter((c) => c.cleaningGoodCratesOk != null);
  const cratesOkPct =
    crateChecks.length > 0 ? (crateChecks.filter((c) => c.cleaningGoodCratesOk).length / crateChecks.length) * 100 : null;

  return {
    key,
    label,
    count: checks.length,
    rejected,
    rejectionRate: (rejected / checks.length) * 100,
    brix: avg((c) => c.brix),
    fruitColorPct: avg((c) => c.fruitColorPct),
    internalQualityPct: avg((c) => c.internalQualityPct),
    cratesOkPct,
    overmaturePct: avg((c) => c.overmaturePct),
    diameterUnder22mmPct: avg((c) => c.diameterUnder22mmPct),
    botrytisPct: avg((c) => c.botrytisPct),
    pestDiseasePct: avg((c) => c.pestDiseasePct),
    wormEatenPct: avg((c) => c.wormEatenPct),
    bruisesPct: avg((c) => c.bruisesPct),
    shapeDeformitiesPct: avg((c) => c.shapeDeformitiesPct),
    sandDustPct: avg((c) => c.sandDustPct),
    foreignBodiesPct: avg((c) => c.foreignBodiesPct),
  };
}

function groupBy<T>(items: T[], keyFn: (item: T) => string | null) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function toTicketCheck(c: Check): TicketCheck {
  return {
    id: c.id,
    createdAt: c.createdAt,
    decision: c.decision,
    brix: c.brix,
    fruitColorPct: c.fruitColorPct,
    internalQualityPct: c.internalQualityPct,
    cleaningGoodCratesOk: c.cleaningGoodCratesOk,
    overmaturePct: c.overmaturePct,
    diameterUnder22mmPct: c.diameterUnder22mmPct,
    botrytisPct: c.botrytisPct,
    pestDiseasePct: c.pestDiseasePct,
    wormEatenPct: c.wormEatenPct,
    bruisesPct: c.bruisesPct,
    shapeDeformitiesPct: c.shapeDeformitiesPct,
    sandDustPct: c.sandDustPct,
    foreignBodiesPct: c.foreignBodiesPct,
    ticket: c.harvestTicketPlotLine
      ? {
          serialNumber: c.harvestTicketPlotLine.harvestTicket?.serialNumber ?? null,
          harvestDate: c.harvestTicketPlotLine.harvestTicket?.harvestDate ?? null,
          stationNo: c.harvestTicketPlotLine.stationNo,
          plotValveGhNo: c.harvestTicketPlotLine.plotValveGhNo,
          cutNo: c.harvestTicketPlotLine.cutNo,
          weightKg: c.harvestTicketPlotLine.weightKg,
          cratesCount: c.harvestTicketPlotLine.cratesCount,
        }
      : null,
  };
}

// Builds one bucket's flat per-field rollup (no farm layer -- every Field
// belongs to the same single farm, so a grouping level above field would
// always be exactly one row) plus, on each field row, the raw checks that fed
// it, for the ticket-level drill-down.
function buildFieldRows(checks: Check[], fieldById: Map<string, Field>, prevChecks: Check[]): FieldRow[] {
  const byField = groupBy(checks, (c) => c.fieldId);
  const prevByField = groupBy(prevChecks, (c) => c.fieldId);

  return [...byField.entries()]
    .map(([fieldId, rows]): FieldRow | null => {
      const field = fieldById.get(fieldId);
      if (!field) return null;
      const agg = aggregate(rows, fieldId, field.name);
      if (!agg) return null;
      const prevRows = prevByField.get(fieldId);
      const prevRate = prevRows ? aggregate(prevRows, fieldId, field.name)?.rejectionRate ?? null : null;
      return {
        ...agg,
        prevRejectionRate: prevRate,
        checks: rows
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(toTicketCheck),
      };
    })
    .filter((r): r is FieldRow => r !== null)
    .sort((a, b) => b.rejectionRate - a.rejectionRate);
}

// Groups checks into time buckets, sorted most-recent first. Trend for each
// bucket compares against the immediately preceding bucket that actually has
// data, not a fixed calendar offset.
function bucketSections(
  checks: Check[],
  fieldById: Map<string, Field>,
  keyFn: (d: Date) => string,
  labelFn: (key: string) => string,
  sortValueFn: (key: string) => number,
  take: number
): PeriodSection[] {
  const byBucket = groupBy(checks, (c) => keyFn(c.createdAt));
  const sortedKeys = [...byBucket.keys()].sort((a, b) => sortValueFn(b) - sortValueFn(a));
  const shown = sortedKeys.slice(0, take);

  return shown.map((key, i) => {
    const bucketChecks = byBucket.get(key)!;
    const prevKey = sortedKeys[i + 1];
    const prevChecks = prevKey ? byBucket.get(prevKey)! : [];
    return { key, label: labelFn(key), rows: buildFieldRows(bucketChecks, fieldById, prevChecks) };
  });
}

export default async function FieldQualityPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const locale = await resolveLocale();
  const dict = getDictionary(locale).fieldQuality;

  const fields = await prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } });
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const currentSeasonStartYear = Number(egyptSeasonKey(new Date()).split("-")[0]);
  const queryCutoff = egyptSeasonStart(currentSeasonStartYear - (SEASON_BUCKET_COUNT - 1));

  const checks = (await prisma.qualityCheck.findMany({
    where: { checkpoint: "PRE_DECAP", fieldId: { not: null }, createdAt: { gte: queryCutoff } },
    select: CHECK_SELECT,
  })) as unknown as Check[];

  const dataByPeriod: Record<Period, PeriodSection[]> = {
    DAILY: bucketSections(
      checks,
      fieldById,
      (d) => egyptDateKey(d),
      (key) => formatDate(parseDateKey(key), "dd MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      14
    ),
    WEEKLY: bucketSections(
      checks,
      fieldById,
      (d) => formatYMD(startOfWeek(egyptDateOnly(d), { weekStartsOn: 1 })),
      (key) => dict.weekOfLabel.replace("{date}", formatDate(parseDateKey(key), "dd MMM yyyy", locale)),
      (key) => parseDateKey(key).getTime(),
      8
    ),
    MONTHLY: bucketSections(
      checks,
      fieldById,
      (d) => egyptMonthKey(d),
      (key) => formatDate(parseDateKey(key), "MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      6
    ),
    SEASON: bucketSections(
      checks,
      fieldById,
      (d) => egyptSeasonKey(d),
      (key) => egyptSeasonLabel(key, locale),
      (key) => Number(key.split("-")[0]),
      SEASON_BUCKET_COUNT
    ),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <FieldQualityTable dataByPeriod={dataByPeriod} />
    </div>
  );
}
