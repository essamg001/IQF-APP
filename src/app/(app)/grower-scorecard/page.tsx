import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format, startOfWeek } from "date-fns";
import { egyptDateKey, egyptDateOnly, egyptMonthKey, formatYMD, parseDateKey } from "@/lib/timezone";
import { GrowerScorecardTable, type Period, type PeriodSection, type ScoreRow } from "./grower-scorecard-table";
import type { Field } from "@prisma/client";

const CHECK_SELECT = {
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
} as const;

type Check = {
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
};

function aggregate(checks: Check[], key: string, label: string): ScoreRow | null {
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

// Builds one bucket's farm-rollup + per-field drill-down, e.g. everything
// harvested on a single day -- multiple tractor-loads from the same field
// on the same day share one fieldId, so they're already averaged together
// here rather than shown as separate entries.
function buildFarmFieldRows(checks: Check[], fieldById: Map<string, Field>, prevChecks: Check[]) {
  const byFarm = groupBy(checks, (c) => (c.fieldId ? fieldById.get(c.fieldId)?.farmName ?? null : null));
  const byField = groupBy(checks, (c) => c.fieldId);
  const prevByFarm = groupBy(prevChecks, (c) => (c.fieldId ? fieldById.get(c.fieldId)?.farmName ?? null : null));
  const prevByField = groupBy(prevChecks, (c) => c.fieldId);

  const farmRows = [...byFarm.entries()]
    .map(([farmName, rows]) => aggregate(rows, farmName, farmName))
    .filter((r): r is ScoreRow => r !== null)
    .map((r) => {
      const prev = prevByFarm.get(r.key);
      const prevRate = prev ? aggregate(prev, r.key, r.label)?.rejectionRate ?? null : null;
      return { ...r, prevRejectionRate: prevRate };
    })
    .sort((a, b) => b.rejectionRate - a.rejectionRate);

  const fieldRowsByFarm: Record<string, ScoreRow[]> = {};
  for (const [fieldId, rows] of byField.entries()) {
    const field = fieldById.get(fieldId);
    if (!field?.farmName) continue;
    const row = aggregate(rows, fieldId, field.name);
    if (!row) continue;
    const prev = prevByField.get(fieldId);
    const prevRate = prev ? aggregate(prev, fieldId, field.name)?.rejectionRate ?? null : null;
    const list = fieldRowsByFarm[field.farmName] ?? [];
    list.push({ ...row, prevRejectionRate: prevRate });
    fieldRowsByFarm[field.farmName] = list;
  }
  for (const list of Object.values(fieldRowsByFarm)) list.sort((a, b) => b.rejectionRate - a.rejectionRate);

  return { farmRows, fieldRowsByFarm };
}

// Groups checks into time buckets (e.g. one per day), sorted most-recent
// first. Trend for each bucket compares against the immediately preceding
// bucket that actually has data, not a fixed calendar offset -- harvesting
// happens daily so gaps should be rare, but this stays correct if one occurs.
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
    const { farmRows, fieldRowsByFarm } = buildFarmFieldRows(bucketChecks, fieldById, prevChecks);
    return { key, label: labelFn(key), farmRows, fieldRowsByFarm };
  });
}

export default async function GrowerScorecardPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const fields = await prisma.field.findMany({ where: { farmName: { not: null }, variety: "MS1" } });
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const checks = await prisma.qualityCheck.findMany({
    where: { checkpoint: "PRE_DECAP", fieldId: { not: null }, createdAt: { gte: sixMonthsAgo } },
    select: CHECK_SELECT,
  });

  const dataByPeriod: Record<Period, PeriodSection[]> = {
    DAILY: bucketSections(
      checks,
      fieldById,
      (d) => egyptDateKey(d),
      (key) => format(parseDateKey(key), "dd MMM yyyy"),
      (key) => parseDateKey(key).getTime(),
      14
    ),
    WEEKLY: bucketSections(
      checks,
      fieldById,
      (d) => formatYMD(startOfWeek(egyptDateOnly(d), { weekStartsOn: 1 })),
      (key) => `Week of ${format(parseDateKey(key), "dd MMM yyyy")}`,
      (key) => parseDateKey(key).getTime(),
      8
    ),
    MONTHLY: bucketSections(
      checks,
      fieldById,
      (d) => egyptMonthKey(d),
      (key) => format(parseDateKey(key), "MMM yyyy"),
      (key) => parseDateKey(key).getTime(),
      6
    ),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Harvest Report</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pre-Decap Arrival quality rolled up per grower/farm and day, with each farm&apos;s individual plots
          underneath — multiple tractor-loads from the same field on the same day are averaged into one figure, not
          shown separately. Trend compares each period to the one immediately before it.
        </p>
      </div>

      <GrowerScorecardTable dataByPeriod={dataByPeriod} />
    </div>
  );
}
