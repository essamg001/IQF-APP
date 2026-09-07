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
import { PrintButton } from "@/components/ui/print-button";

const SEASON_BUCKET_COUNT = 3;

type RawLine = { fieldId: string; weightKg: number; date: Date };
type QuantityLine = { rawIncomingTon: number; totalPackedTon: number; date: Date };

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

function buildFieldRows(raw: RawLine[], fieldById: Map<string, Field>, prevRaw: RawLine[]): FieldYieldRow[] {
  const rawByField = groupBy(raw, (r) => r.fieldId);
  const prevRawByField = groupBy(prevRaw, (r) => r.fieldId);

  return [...rawByField.keys()]
    .map((fieldId): FieldYieldRow | null => {
      const field = fieldById.get(fieldId);
      if (!field) return null;
      const lines = rawByField.get(fieldId) ?? [];
      const prevLines = prevRawByField.get(fieldId) ?? [];
      return {
        key: fieldId,
        label: field.name,
        rawKg: lines.reduce((s, l) => s + l.weightKg, 0),
        rawLineCount: lines.length,
        prevRawKg: prevLines.length > 0 ? prevLines.reduce((s, l) => s + l.weightKg, 0) : null,
      };
    })
    .filter((r): r is FieldYieldRow => r !== null)
    .sort((a, b) => b.rawKg - a.rawKg);
}

function bucketSections(
  raw: RawLine[],
  quantities: QuantityLine[],
  fieldById: Map<string, Field>,
  keyFn: (d: Date) => string,
  labelFn: (key: string) => string,
  sortValueFn: (key: string) => number,
  take: number
): PeriodSection[] {
  const rawByBucket = groupBy(raw, (r) => keyFn(r.date));
  const quantitiesByBucket = groupBy(quantities, (q) => keyFn(q.date));
  const sortedKeys = [...new Set([...rawByBucket.keys(), ...quantitiesByBucket.keys()])].sort(
    (a, b) => sortValueFn(b) - sortValueFn(a)
  );
  const shown = sortedKeys.slice(0, take);

  // Scoped to fields present in fieldById (the MS1 set Field Quality also
  // uses) so the per-field rows and their total reconcile with each other.
  const inScope = (r: RawLine) => fieldById.has(r.fieldId);

  return shown.map((key, i) => {
    const bucketRaw = (rawByBucket.get(key) ?? []).filter(inScope);
    const prevKey = sortedKeys[i + 1];
    const prevRaw = (prevKey ? rawByBucket.get(prevKey) ?? [] : []).filter(inScope);
    const bucketQuantities = quantitiesByBucket.get(key) ?? [];

    const overallRawTon = bucketQuantities.reduce((s, q) => s + q.rawIncomingTon, 0);
    const overallPackedTon = bucketQuantities.reduce((s, q) => s + q.totalPackedTon, 0);

    return {
      key,
      label: labelFn(key),
      rows: buildFieldRows(bucketRaw, fieldById, prevRaw),
      totalRawKg: bucketRaw.reduce((s, r) => s + r.weightKg, 0),
      overallRecoveryPct: overallRawTon > 0 ? (overallPackedTon / overallRawTon) * 100 : null,
      overallRawTon,
      overallPackedTon,
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

  const [plotLines, quantityEntries] = await Promise.all([
    prisma.harvestTicketPlotLine.findMany({
      where: {
        fieldId: { not: null },
        weightKg: { not: null },
        harvestTicket: { OR: [{ receivedDate: { gte: queryCutoff } }, { harvestDate: { gte: queryCutoff } }] },
      },
      select: { fieldId: true, weightKg: true, harvestTicket: { select: { receivedDate: true, harvestDate: true } } },
    }),
    prisma.dailyQuantityEntry.findMany({
      where: { date: { gte: queryCutoff } },
      select: { date: true, rawIncomingTon: true, totalPackedTon: true },
    }),
  ]);

  const raw: RawLine[] = plotLines
    .map((l) => {
      const date = l.harvestTicket.receivedDate ?? l.harvestTicket.harvestDate;
      return date && l.fieldId && l.weightKg != null ? { fieldId: l.fieldId, weightKg: l.weightKg, date } : null;
    })
    .filter((r): r is RawLine => r !== null);

  const quantities: QuantityLine[] = quantityEntries.map((q) => ({
    date: q.date,
    rawIncomingTon: q.rawIncomingTon ?? 0,
    totalPackedTon: q.totalPackedTon ?? 0,
  }));

  const dataByPeriod: Record<Period, PeriodSection[]> = {
    DAILY: bucketSections(
      raw,
      quantities,
      fieldById,
      (d) => egyptDateKey(d),
      (key) => formatDate(parseDateKey(key), "dd MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      14
    ),
    WEEKLY: bucketSections(
      raw,
      quantities,
      fieldById,
      (d) => formatYMD(startOfWeek(egyptDateOnly(d), { weekStartsOn: 1 })),
      (key) => dict.weekOfLabel.replace("{date}", formatDate(parseDateKey(key), "dd MMM yyyy", locale)),
      (key) => parseDateKey(key).getTime(),
      8
    ),
    MONTHLY: bucketSections(
      raw,
      quantities,
      fieldById,
      (d) => egyptMonthKey(d),
      (key) => formatDate(parseDateKey(key), "MMM yyyy", locale),
      (key) => parseDateKey(key).getTime(),
      6
    ),
    SEASON: bucketSections(
      raw,
      quantities,
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

      <YieldRecoveryTable dataByPeriod={dataByPeriod} />
    </div>
  );
}
