"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DowntimeEntryForm } from "./downtime-entry-form";
import { EfficiencyForm } from "./efficiency-form";
import { removeDowntimeEventAction } from "./actions";
import { useTranslations } from "@/lib/i18n/locale-context";

type DowntimeEvent = { id: string; shiftType: string; reason: string; fromTime: Date; toTime: Date };
type Efficiency = {
  shiftType: string;
  uptimeFrom: Date | null;
  uptimeTo: Date | null;
  lineCapacityTonPerHour: number | null;
  expectedQuantityTon: number | null;
  actualQuantityTon: number | null;
};

// Downtime logged against a shift can legitimately exceed that shift's own
// uptime window (e.g. downtime events spilling past a shift boundary) --
// clamped to 0 rather than rendering a broken "-15:-12"-style negative
// duration, since "less than no time ran" isn't a real duration to display.
function formatDuration(minutes: number) {
  const clamped = Math.max(0, minutes);
  const h = Math.floor(clamped / 60);
  const m = Math.round(clamped % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function ShiftBlock({
  factoryId,
  date,
  shiftType,
  events,
  efficiency,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  events: DowntimeEvent[];
  efficiency: Efficiency | null;
}) {
  const totalDowntimeMin = events.reduce((s, e) => s + (e.toTime.getTime() - e.fromTime.getTime()) / 60000, 0);
  const uptimeMin =
    efficiency?.uptimeFrom && efficiency?.uptimeTo
      ? (efficiency.uptimeTo.getTime() - efficiency.uptimeFrom.getTime()) / 60000
      : null;
  const actualRunTimeMin = uptimeMin != null ? uptimeMin - totalDowntimeMin : null;
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {shiftType === "DAY" ? dict.shift1Day : dict.shift2Night}
      </h4>

      <div className="mt-2">
        <EfficiencyForm factoryId={factoryId} date={date} shiftType={shiftType} efficiency={efficiency} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">{dict.totalDowntimeLabel}</dt>
          <dd className="font-medium text-slate-800">{formatDuration(totalDowntimeMin)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">{dict.actualRunTimeLabel}</dt>
          <dd className="font-medium text-slate-800">{actualRunTimeMin != null ? formatDuration(actualRunTimeMin) : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">{dict.expectedVsActualLabel}</dt>
          <dd className="font-medium text-slate-800">
            {dict.expectedVsActualValue
              .replace("{expected}", String(efficiency?.expectedQuantityTon ?? "—"))
              .replace("{actual}", String(efficiency?.actualQuantityTon ?? "—"))}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1 text-xs font-medium text-slate-500">{dict.downtimeEventsLabel}</p>
        {events.length > 0 && (
          <ul className="mb-2 space-y-1 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {dict.downtimeEventLine
                    .replace("{from}", e.fromTime.toTimeString().slice(0, 5))
                    .replace("{to}", e.toTime.toTimeString().slice(0, 5))
                    .replace("{reason}", e.reason)}
                </span>
                <form action={removeDowntimeEventAction.bind(null, e.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={dict.removeDowntimeConfirm.replace("{reason}", e.reason)}
                    className="text-red-600 hover:underline"
                  >
                    {fullDict.common.remove}
                  </ConfirmSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <DowntimeEntryForm factoryId={factoryId} date={date} />
      </div>
    </div>
  );
}

export function EfficiencySection({
  factoryId,
  factoryName,
  date,
  events,
  efficiencyByShift,
}: {
  factoryId: string;
  factoryName: string;
  date: string;
  events: DowntimeEvent[];
  efficiencyByShift: Record<string, Efficiency | null>;
}) {
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          {dict.efficiencySectionTitle.replace("{factory}", factoryName)}
        </h3>
        <Badge color="slate">{dict.eventsCountBadge.replace("{count}", String(events.length))}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <ShiftBlock
          factoryId={factoryId}
          date={date}
          shiftType="DAY"
          events={events.filter((e) => e.shiftType === "DAY")}
          efficiency={efficiencyByShift.DAY ?? null}
        />
        <ShiftBlock
          factoryId={factoryId}
          date={date}
          shiftType="NIGHT"
          events={events.filter((e) => e.shiftType === "NIGHT")}
          efficiency={efficiencyByShift.NIGHT ?? null}
        />
      </div>
    </Card>
  );
}
