import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { DowntimeEntryForm } from "./downtime-entry-form";
import { EfficiencyForm } from "./efficiency-form";
import { removeDowntimeEventAction } from "./actions";

type DowntimeEvent = { id: string; shiftType: string; reason: string; fromTime: Date; toTime: Date };
type Efficiency = {
  shiftType: string;
  uptimeFrom: Date | null;
  uptimeTo: Date | null;
  lineCapacityTonPerHour: number | null;
  expectedQuantityTon: number | null;
  actualQuantityTon: number | null;
};

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
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

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
      </h4>

      <div className="mt-2">
        <EfficiencyForm factoryId={factoryId} date={date} shiftType={shiftType} efficiency={efficiency} />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-slate-400">Total downtime</dt>
          <dd className="font-medium text-slate-800">{formatDuration(totalDowntimeMin)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Actual run time</dt>
          <dd className="font-medium text-slate-800">{actualRunTimeMin != null ? formatDuration(actualRunTimeMin) : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Expected vs actual</dt>
          <dd className="font-medium text-slate-800">
            {efficiency?.expectedQuantityTon ?? "—"} / {efficiency?.actualQuantityTon ?? "—"} t
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1 text-xs font-medium text-slate-500">Downtime events</p>
        {events.length > 0 && (
          <ul className="mb-2 space-y-1 text-xs">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between">
                <span>
                  {e.fromTime.toTimeString().slice(0, 5)}–{e.toTime.toTimeString().slice(0, 5)} · {e.reason}
                </span>
                <form action={removeDowntimeEventAction.bind(null, e.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`Remove this downtime event (${e.reason})?`}
                    className="text-red-600 hover:underline"
                  >
                    Remove
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
  return (
    <Card>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Line Efficiency &amp; Downtime</h3>
        <Badge color="slate">{events.length} events</Badge>
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
