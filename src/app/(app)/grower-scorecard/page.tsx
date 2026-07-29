import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { GrowerScorecardTable, type ScoreRow } from "./grower-scorecard-table";

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
  fruitColorPct: number;
  internalQualityPct: number;
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

export default async function GrowerScorecardPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { start: startParam, end: endParam } = await searchParams;

  const end = endParam ? new Date(`${endParam}T23:59:59`) : new Date();
  const start = startParam ? new Date(`${startParam}T00:00:00`) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(start.getTime() - spanMs);

  const fields = await prisma.field.findMany({ where: { farmName: { not: null }, variety: "MS1" } });
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const [checks, prevChecks] = await Promise.all([
    prisma.qualityCheck.findMany({
      where: { checkpoint: "PRE_DECAP", fieldId: { not: null }, createdAt: { gte: start, lte: end } },
      select: CHECK_SELECT,
    }),
    prisma.qualityCheck.findMany({
      where: { checkpoint: "PRE_DECAP", fieldId: { not: null }, createdAt: { gte: prevStart, lte: prevEnd } },
      select: CHECK_SELECT,
    }),
  ]);

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

  const fieldRowsByFarm = new Map<string, ScoreRow[]>();
  for (const [fieldId, rows] of byField.entries()) {
    const field = fieldById.get(fieldId);
    if (!field?.farmName) continue;
    const row = aggregate(rows, fieldId, field.name);
    if (!row) continue;
    const prev = prevByField.get(fieldId);
    const prevRate = prev ? aggregate(prev, fieldId, field.name)?.rejectionRate ?? null : null;
    const list = fieldRowsByFarm.get(field.farmName) ?? [];
    list.push({ ...row, prevRejectionRate: prevRate });
    fieldRowsByFarm.set(field.farmName, list);
  }
  for (const list of fieldRowsByFarm.values()) list.sort((a, b) => b.rejectionRate - a.rejectionRate);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Harvest Report</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pre-Decap Arrival quality rolled up per grower/farm, with each farm&apos;s individual plots underneath.
          Trend compares against the same-length period immediately before this range. Set the range to a season to
          use this as a season-end review.
        </p>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start</label>
            <Input name="start" type="date" defaultValue={fmt(start)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End</label>
            <Input name="end" type="date" defaultValue={fmt(end)} />
          </div>
          <Button type="submit">Run</Button>
        </form>
      </Card>

      <GrowerScorecardTable farmRows={farmRows} fieldRowsByFarm={Object.fromEntries(fieldRowsByFarm)} />
    </div>
  );
}
