import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { limitsFor } from "@/lib/qualityLimits";
import { format, startOfWeek } from "date-fns";
import { egyptDateKey, egyptDateOnly, egyptMonthKey, formatYMD, parseDateKey } from "@/lib/timezone";
import { QualityPeriodTable, type MetricDef, type Period, type PeriodRow } from "./quality-period-table";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const RAW_MATERIAL_METRICS: MetricDef[] = [
  { key: "brix", label: "Brix", suffix: "" },
  ...limitsFor("RAW_MATERIAL").map((r) => ({
    key: r.field,
    label: `${r.label} (${r.max != null ? `≤${r.max}%` : `≥${r.min}%`})`,
    suffix: "%",
  })),
];

// Post-Packaging's tolerances differ by Grade (A vs B) for the same field
// names, so the limit isn't shown in the header here -- Grade A's field list
// is used as the reference set since both grades share the same fields.
const POST_PACKAGING_METRICS: MetricDef[] = [
  { key: "brix", label: "Brix", suffix: "" },
  ...limitsFor("POST_PACKAGING", "A").map((r) => ({ key: r.field, label: r.label, suffix: "%" })),
];

type Check = {
  id: string;
  createdAt: Date;
  decision: string | null;
  brix: number;
  shiftNumber: string | null;
  lot?: { shiftId: string; shift: { date: Date; factory: { name: string } } } | null;
  [key: string]: unknown;
};

function aggregate(rows: Check[], metrics: MetricDef[], key: string, label: string, sortValue: number): PeriodRow & { sortValue: number } {
  const avg = (get: (r: Check) => number | null) => {
    const vals = rows.map(get).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const rejected = rows.filter((r) => r.decision === "REJECTED").length;
  const metricValues: Record<string, number | null> = {};
  for (const m of metrics) {
    if (m.key === "brix") continue;
    metricValues[m.key] = avg((r) => r[m.key] as number | null);
  }
  return {
    key,
    label,
    sortValue,
    count: rows.length,
    rejected,
    rejectionRate: rows.length ? (rejected / rows.length) * 100 : 0,
    brix: avg((r) => r.brix),
    metrics: metricValues,
  };
}

function groupBy(rows: Check[], keyFn: (r: Check) => string) {
  const map = new Map<string, Check[]>();
  for (const r of rows) {
    const key = keyFn(r);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

function byDay(rows: Check[], metrics: MetricDef[], take: number): PeriodRow[] {
  const groups = groupBy(rows, (r) => egyptDateKey(r.createdAt));
  return [...groups.entries()]
    .map(([key, group]) => aggregate(group, metrics, key, format(parseDateKey(key), "dd MMM yyyy"), parseDateKey(key).getTime()))
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, take);
}

function byWeek(rows: Check[], metrics: MetricDef[], take: number): PeriodRow[] {
  const groups = groupBy(rows, (r) => formatYMD(startOfWeek(egyptDateOnly(r.createdAt), { weekStartsOn: 1 })));
  return [...groups.entries()]
    .map(([key, group]) => aggregate(group, metrics, key, `Week of ${format(parseDateKey(key), "dd MMM yyyy")}`, parseDateKey(key).getTime()))
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, take);
}

function byMonth(rows: Check[], metrics: MetricDef[], take: number): PeriodRow[] {
  const groups = groupBy(rows, (r) => egyptMonthKey(r.createdAt));
  return [...groups.entries()]
    .map(([key, group]) => aggregate(group, metrics, key, format(parseDateKey(key), "MMM yyyy"), parseDateKey(key).getTime()))
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, take);
}

export default async function QualityPage() {
  const dict = getDictionary(await resolveLocale()).qualityReports;
  // Both checkpoints are filled in automatically from their own dedicated
  // fast-entry screens -- Raw Material Intake from Arrival Inspection at
  // Factory, Post-Packaging/Final Product from Post-Freeze Inspection.
  // Pallet-by-pallet results live on those two screens; this page is
  // averages only, at four different granularities.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [rawChecks, postChecks] = await Promise.all([
    prisma.qualityCheck.findMany({
      where: { checkpoint: "RAW_MATERIAL", createdAt: { gte: sixMonthsAgo } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qualityCheck.findMany({
      where: { checkpoint: "POST_PACKAGING", createdAt: { gte: sixMonthsAgo } },
      include: { lot: { include: { shift: { include: { factory: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rawByShift = [
    ...groupBy(rawChecks as Check[], (r) => `${egyptDateKey(r.createdAt)}::${r.shiftNumber ?? "unspecified"}`).entries(),
  ]
    .map(([key, group]) =>
      aggregate(
        group,
        RAW_MATERIAL_METRICS,
        key,
        `${format(egyptDateOnly(group[0].createdAt), "dd MMM yyyy")} — Shift ${group[0].shiftNumber ?? "—"}`,
        group[0].createdAt.getTime()
      )
    )
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, 30);

  const rawByPeriod: Record<Period, PeriodRow[]> = {
    SHIFT: rawByShift,
    DAILY: byDay(rawChecks as Check[], RAW_MATERIAL_METRICS, 14),
    WEEKLY: byWeek(rawChecks as Check[], RAW_MATERIAL_METRICS, 8),
    MONTHLY: byMonth(rawChecks as Check[], RAW_MATERIAL_METRICS, 6),
  };

  // A handful of older Post-Packaging rows predate the lot relation being
  // required and have no lot -- excluded from the shift breakdown since
  // there's no shift to group them by, same as they'd be excluded anywhere
  // else on the site that depends on lot -> shift.
  const postLotTied = (postChecks as Check[]).filter((c) => c.lot);
  const postByShift = [...groupBy(postLotTied, (r) => r.lot!.shiftId).entries()]
    .map(([key, group]) =>
      aggregate(
        group,
        POST_PACKAGING_METRICS,
        key,
        `${format(group[0].lot!.shift.date, "dd MMM yyyy")} — ${group[0].lot!.shift.factory.name}`,
        group[0].lot!.shift.date.getTime()
      )
    )
    .sort((a, b) => b.sortValue - a.sortValue)
    .slice(0, 30);

  const postByPeriod: Record<Period, PeriodRow[]> = {
    SHIFT: postByShift,
    DAILY: byDay(postChecks as Check[], POST_PACKAGING_METRICS, 14),
    WEEKLY: byWeek(postChecks as Check[], POST_PACKAGING_METRICS, 8),
    MONTHLY: byMonth(postChecks as Check[], POST_PACKAGING_METRICS, 6),
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/arrival-inspection" variant="secondary">
            {dict.logArrivalInspection}
          </LinkButton>
          <LinkButton href="/post-freeze-inspection">{dict.logPostFreezeInspection}</LinkButton>
        </div>
      </div>

      <QualityPeriodTable
        title={dict.rawMaterialTitle}
        description={dict.rawMaterialDescription}
        dataByPeriod={rawByPeriod}
        metrics={RAW_MATERIAL_METRICS}
      />

      <QualityPeriodTable
        title={dict.postPackagingTitle}
        description={dict.postPackagingDescription}
        dataByPeriod={postByPeriod}
        metrics={POST_PACKAGING_METRICS}
      />
    </div>
  );
}
