import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CLEANING_AREAS,
  CLEANING_AREA_LABEL,
  cleaningScoreColor,
  isCleaningLocked,
  isLowCleaningScore,
} from "@/lib/cleaning";
import { AreaTrendChart, type AreaTrendPoint } from "./area-trend-chart";

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

function dayKey(date: Date, shiftType: string) {
  return `${date.getTime()}|${shiftType}`;
}

export function FactoryHistorySection({
  factoryName,
  scores,
  records,
}: {
  factoryName: string;
  scores: Score[];
  records: ShiftRecord[];
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
        <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Cleaning History</h3>
        <Badge color={flaggedCount > 0 ? "red" : "green"}>
          {flaggedCount} shift{flaggedCount === 1 ? "" : "s"} flagged
        </Badge>
      </div>

      <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Score Trends</h4>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CLEANING_AREAS.map((area) => (
          <AreaTrendChart key={area} title={CLEANING_AREA_LABEL[area]} data={chartDataByArea[area]} />
        ))}
      </div>

      <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Day-by-Day Log</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Date</th>
              <th className="py-1.5 pr-3 font-medium">Shift</th>
              <th className="py-1.5 pr-3 font-medium">Foam</th>
              <th className="py-1.5 pr-3 font-medium">Head of Production</th>
              <th className="py-1.5 pr-3 font-medium">Head of Maintenance</th>
              <th className="py-1.5 pr-3 font-medium">Flagged Areas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ date, shiftType, record, lowAreas }) => (
              <tr key={dayKey(date, shiftType)} className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 text-slate-800">{format(date, "d MMM yyyy")}</td>
                <td className="py-1.5 pr-3 text-slate-600">{shiftType === "DAY" ? "Day" : "Night"}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.cleanedWithFoam ? "Yes" : "—"}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.productionSignedByName ?? "—"}</td>
                <td className="py-1.5 pr-3 text-slate-600">{record?.maintenanceSignedByName ?? "—"}</td>
                <td className="py-1.5 pr-3">
                  {lowAreas.length === 0 ? (
                    <span className="text-slate-300">None</span>
                  ) : (
                    <span className={cleaningScoreColor(0)}>
                      {lowAreas.map((a) => CLEANING_AREA_LABEL[a]).join(", ")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-slate-400">
                  No cleaning records in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.some((r) => !isCleaningLocked(r.record)) && (
        <p className="mt-2 text-xs text-slate-400">
          Rows without both sign-offs are still in progress or were never completed.
        </p>
      )}
    </Card>
  );
}
