import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CLEANING_AREAS, cleaningScoreColor, isCleaningLocked, isLowCleaningScore } from "@/lib/cleaning";
import type { CleaningArea } from "@prisma/client";
import { AreaTrendChart, type AreaTrendPoint } from "./area-trend-chart";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type Score = {
  date: Date;
  shiftType: "DAY" | "NIGHT";
  area: string;
  productionScore: number | null;
  maintenanceScore: number | null;
};
type ShiftRecord = {
  date: Date;
  shiftType: "DAY" | "NIGHT";
  cleanedWithFoam: boolean;
  productionSignedByName: string | null;
  productionSignedAt: Date | null;
  maintenanceSignedByName: string | null;
  maintenanceSignedAt: Date | null;
};
type HistoryDict = Dictionary["cleaningHistory"];
type ModeDict = Dictionary["cleaningMode"];

function dayKey(date: Date, shiftType: string) {
  return `${date.getTime()}|${shiftType}`;
}

function areaLabel(area: CleaningArea, dict: ModeDict): string {
  const map: { [key in CleaningArea]: string } = {
    ARRIVAL: dict.areaArrival,
    PRE_COOLING: dict.areaPreCooling,
    PROCESSING: dict.areaProcessing,
    PACKAGING: dict.areaPackaging,
    COLD_STORES_AND_CORRIDORS: dict.areaColdStoresAndCorridors,
    LOAD_OUT: dict.areaLoadOut,
    DRY_STORAGE_ROOMS: dict.areaDryStorageRooms,
  };
  return map[area];
}

export function FactoryHistorySection({
  factoryName,
  scores,
  records,
  dict,
  areaDict,
}: {
  factoryName: string;
  scores: Score[];
  records: ShiftRecord[];
  dict: HistoryDict;
  areaDict: ModeDict;
}) {
  // A shift can have scores before it has a ShiftRecord row (the record is
  // only created on the first foam toggle or sign-off) -- union both so no
  // in-progress shift silently drops off the log.
  const rowMap = new Map<string, { date: Date; shiftType: "DAY" | "NIGHT"; record: ShiftRecord | null }>();
  for (const r of records) rowMap.set(dayKey(r.date, r.shiftType), { date: r.date, shiftType: r.shiftType, record: r });
  for (const s of scores) {
    const key = dayKey(s.date, s.shiftType);
    if (!rowMap.has(key)) rowMap.set(key, { date: s.date, shiftType: s.shiftType, record: null });
  }

  const rows = [...rowMap.values()]
    .map(({ date, shiftType, record }) => {
      const shiftScores = scores.filter((s) => s.date.getTime() === date.getTime() && s.shiftType === shiftType);
      const lowAreas = CLEANING_AREAS.filter((area) => {
        const row = shiftScores.find((s) => s.area === area);
        return isLowCleaningScore(row?.productionScore) || isLowCleaningScore(row?.maintenanceScore);
      });
      return { date, shiftType, record, lowAreas };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime() || (a.shiftType === "DAY" ? -1 : 1));

  const flaggedCount = rows.filter((r) => r.lowAreas.length > 0).length;

  const chronological = [...rowMap.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || (a.shiftType === "DAY" ? -1 : 1)
  );

  const chartDataByArea: Record<string, AreaTrendPoint[]> = {};
  for (const area of CLEANING_AREAS) {
    chartDataByArea[area] = chronological.map(({ date, shiftType }) => {
      const row = scores.find((s) => s.date.getTime() === date.getTime() && s.shiftType === shiftType && s.area === area);
      return {
        label: `${format(date, "MMM d")} (${shiftType === "DAY" ? "D" : "N"})`,
        production: row?.productionScore ?? null,
        maintenance: row?.maintenanceScore ?? null,
      };
    });
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {factoryName} — {dict.historySuffix}
        </h3>
        <Badge color={flaggedCount > 0 ? "red" : "green"}>
          {dict.shiftsFlagged
            .replace("{count}", String(flaggedCount))
            .replace("{shiftWord}", flaggedCount === 1 ? dict.shift : dict.shifts)}
        </Badge>
      </div>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.scoreTrends}</h4>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CLEANING_AREAS.map((area) => (
          <AreaTrendChart
            key={area}
            title={areaLabel(area, areaDict)}
            data={chartDataByArea[area]}
            noScoresLabel={dict.noScoresInRange}
            legendProduction={dict.legendProduction}
            legendMaintenance={dict.legendMaintenance}
          />
        ))}
      </div>

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.dayByDayLog}</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-start text-xs">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-medium">{dict.colDate}</th>
              <th className="py-1.5 pr-3 font-medium">{dict.colShift}</th>
              <th className="py-1.5 pr-3 font-medium">{dict.colFoam}</th>
              <th className="py-1.5 pr-3 font-medium">{dict.colHeadOfProduction}</th>
              <th className="py-1.5 pr-3 font-medium">{dict.colHeadOfMaintenance}</th>
              <th className="py-1.5 pr-3 font-medium">{dict.colFlaggedAreas}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ date, shiftType, record, lowAreas }) => (
              <tr key={dayKey(date, shiftType)} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-slate-800">{format(date, "d MMM yyyy")}</td>
                <td className="py-1.5 pr-3 text-slate-600">{shiftType === "DAY" ? dict.day : dict.night}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.cleanedWithFoam ? dict.yes : "—"}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.productionSignedByName ?? "—"}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.maintenanceSignedByName ?? "—"}</td>
                <td className="py-1.5 pr-3">
                  {lowAreas.length === 0 ? (
                    <span className="text-slate-300">{dict.none}</span>
                  ) : (
                    <span className={cleaningScoreColor(0)}>
                      {lowAreas.map((a) => areaLabel(a, areaDict)).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-slate-400">
                  {dict.noRecordsInRange}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.some((r) => !isCleaningLocked(r.record)) && (
        <p className="mt-2 text-xs text-slate-400">{dict.incompleteRowsNote}</p>
      )}
    </Card>
  );
}
