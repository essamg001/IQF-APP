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
import { YieldRecoveryTable, type Period, type PeriodSection, type FieldYieldRow } from "./yield-recovery-table";
import type { Field } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const SEASON_BUCKET_COUNT = 3;

type RawLine = { fieldId: string; weightKg: number; date: Date };
type FinishedLine = { fieldId: string; weightKg: number; date: Date };

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

function aggregateField(fieldId: string, label: string, raw: RawLine[], finished: FinishedLine[]): FieldYieldRow {
  const rawKg = raw.reduce((sum, r) => sum + r.weightKg, 0);
  const finishedKg = finished.reduce((sum, f) => sum + f.weightKg, 0);
  return {
    key: fieldId,
    label,
    rawKg,
    rawLineCount: raw.length,
    finishedKg,
    palletCount: finished.length,
    recoveryPct: rawKg > 0 ? (finishedKg / rawKg) * 100 : null,
  };
}

// Builds one bucket's flat per-field rollup -- same reasoning as Field
// Quality's buildFieldRows: every Field belongs to the same single farm, so
// there's no grouping level above field worth adding.
function buildFieldRows(
  raw: RawLine[],
  finished: FinishedLine[],
  fieldById: Map<string, Field>,
  prevRaw: RawLine[],
  prevFinished: FinishedLine[]
): FieldYieldRow[] {
  const rawByField = groupBy(raw, (r) => r.fieldId);
  const finishedByField = groupBy(finished, (f) => f.fieldId);
  const prevRawByField = groupBy(prevRaw, (r) => r.fieldId);
  const prevFinishedByField = groupBy(prevFinished, (f) => f.fieldId);

  const fieldIds = new Set([...rawByField.keys(), ...finishedByField.keys()]);

  return [...fieldIds]
    .map((fieldId): FieldYieldRow | null => {
      const field = fieldById.get(fieldId);
      if (!field) return null;
      const row = aggregateField(fieldId, field.name, rawByField.get(fieldId) ?? [], finishedByField.get(fieldId) ?? []);
      const prevRow = aggregateField(
        fieldId,
        field.name,
        prevRawByField.get(fieldId) ?? [],
        prevFinishedByField.get(fieldId) ?? []
      );
      return { ...row, prevRecoveryPct: prevRow.recoveryPct };
    })
    .filter((r): r is FieldYieldRow => r !== null)
    .sort((a, b) => {
      // Fields with no measurable recovery this period sink to the bottom --
      // nothing to compare, not a 0% recovery.
      if (a.recoveryPct == null && b.recoveryPct == null) return 0;
      if (a.recoveryPct == null) return 1;
      if (b.recoveryPct == null) return -1;
      return a.recoveryPct - b.recoveryPct;
    });
}

function bucketSections(
  raw: RawLine[],
  finished: FinishedLine[],
  fieldById: Map<string, Field>,
  keyFn: (d: Date) => string,
  labelFn: (key: string) => string,
  sortValueFn: (key: string) => number,
  take: number
): PeriodSection[] {
  const rawByBucket = groupBy(raw, (r) => keyFn(r.date));
  const finishedByBucket = groupBy(finished, (f) => keyFn(f.date));
  const sortedKeys = [...new Set([...rawByBucket.keys(), ...finishedByBucket.keys()])].sort(
    (a, b) => sortValueFn(b) - sortValueFn(a)
  );
  const shown = sortedKeys.slice(0, take);

  // Scoped to fields present in fieldById (the MS1 set Field Quality also
  // uses) so the "Overall" figure always reconciles with the sum of the
  // field rows shown below it -- rather than silently including weight from
  // fields the table itself drops.
  const inScope = (r: RawLine | FinishedLine) => fieldById.has(r.fieldId);

  return shown.map((key, i) => {
    const bucketRaw = (rawByBucket.get(key) ?? []).filter(inScope);
    const bucketFinished = (finishedByBucket.get(key) ?? []).filter(inScope);
    const prevKey = sortedKeys[i + 1];
    const prevRaw = (prevKey ? rawByBucket.get(prevKey) ?? [] : []).filter(inScope);
    const prevFinished = (prevKey ? finishedByBucket.get(prevKey) ?? [] : []).filter(inScope);
    const overall = aggregateField("overall", "Overall", bucketRaw, bucketFinished);
    return {
      key,
      label: labelFn(key),
      rows: buildFieldRows(bucketRaw, bucketFinished, fieldById, prevRaw, prevFinished),
      overallRawKg: overall.rawKg,
      overallFinishedKg: overall.finishedKg,
      overallRecoveryPct: overall.recoveryPct,
    };
  });
}

export default async function YieldRecoveryPage() {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }
  const locale = await resolveLocale();
  const dict = getDictionary(locale).yieldRecovery;

  const fields = await prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } });
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const currentSeasonStartYear = Number(egyptSeasonKey(new Date()).split("-")[0]);
  const queryCutoff = egyptSeasonStart(currentSeasonStartYear - (SEASON_BUCKET_COUNT - 1));

  const [plotLines, pallets] = await Promise.all([
    prisma.harvestTicketPlotLine.findMany({
      where: {
        fieldId: { not: null },
        weightKg: { not: null },
        harvestTicket: { OR: [{ receivedDate: { gte: queryCutoff } }, { harvestDate: { gte: queryCutoff } }] },
      },
      select: { fieldId: true, weightKg: true, harvestTicket: { select: { receivedDate: true, harvestDate: true } } },
    }),
    prisma.pallet.findMany({
      where: { createdAt: { gte: queryCutoff } },
      select: { weightTonnes: true, createdAt: true, lot: { select: { fieldId: true } } },
    }),
  ]);

  const raw: RawLine[] = plotLines
    .map((l) => {
      const date = l.harvestTicket.receivedDate ?? l.harvestTicket.harvestDate;
      return date && l.fieldId && l.weightKg != null ? { fieldId: l.fieldId, weightKg: l.weightKg, date } : null;
    })
    .filter((r): r is RawLine => r !== null);

  const finished: FinishedLine[] = pallets.map((p) => ({
    fieldId: p.lot.fieldId,
    weightKg: p.weightTonnes * 1000,
    date: p.createdAt,
  }));

  const dataByPeriod: Record<Period, PeriodSection[]> = {
    DAILY: bucketSections(
      raw,
      finished,
      fieldById,
      (d) => egyptDateKey(d),
      (key) => formatDate(parseDateKey(key), "dd MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      14
    ),
    WEEKLY: bucketSections(
      raw,
      finished,
      fieldById,
      (d) => formatYMD(startOfWeek(egyptDateOnly(d), { weekStartsOn: 1 })),
      (key) => dict.weekOfLabel.replace("{date}", formatDate(parseDateKey(key), "dd MMM yyyy", locale)),
      (key) => parseDateKey(key).getTime(),
      8
    ),
    MONTHLY: bucketSections(
      raw,
      finished,
      fieldById,
      (d) => egyptMonthKey(d),
      (key) => formatDate(parseDateKey(key), "MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      6
    ),
    SEASON: bucketSections(
      raw,
      finished,
      fieldById,
      (d) => egyptSeasonKey(d),
      (key) => egyptSeasonLabel(key, locale),
      (key) => Number(key.split("-")[0]),
      SEASON_BUCKET_COUNT
    ),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <YieldRecoveryTable dataByPeriod={dataByPeriod} />
    </div>
  );
}
