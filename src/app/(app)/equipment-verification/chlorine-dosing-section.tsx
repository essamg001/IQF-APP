"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createChlorineDosingCheckAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HourCoverageGrid } from "./hour-coverage-grid";
import { SHIFT_HOURS, hourSlotDate, toDateTimeLocalValue } from "@/lib/shiftHours";
import { parseLocalDateOnly } from "@/lib/dates";
import type { ChlorineDosingCheck, ShiftType } from "@prisma/client";

export function ChlorineDosingSection({
  factoryId,
  date,
  shiftType,
  checks,
  currentUserLabel,
  now,
}: {
  factoryId: string;
  date: string;
  shiftType: ShiftType;
  checks: ChlorineDosingCheck[];
  currentUserLabel: string | null;
  now: Date;
}) {
  const [presetHour, setPresetHour] = useState<number | null>(null);
  const shiftDate = parseLocalDateOnly(date) ?? now;
  const hours = SHIFT_HOURS[shiftType];

  const latestByHour = new Map<number, ChlorineDosingCheck>();
  for (const c of checks) latestByHour.set(c.recordedAt.getHours(), c);

  const defaultRecordedAt =
    presetHour != null ? toDateTimeLocalValue(hourSlotDate(shiftDate, shiftType, presetHour)) : "";

  const [state, formAction, pending] = useActionState(createChlorineDosingCheckAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <h5 className="text-xs font-semibold text-slate-700">Dosing Pump / Chlorine — STR03117</h5>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Free chlorine dosed into the wash tank, injected — checked hourly against the dosing machine&apos;s set point.
      </p>

      <div className="mt-2">
        <HourCoverageGrid
          hours={hours}
          hasCheck={(h) => latestByHour.has(h)}
          elapsed={(h) => hourSlotDate(shiftDate, shiftType, h) <= now}
          onPick={setPresetHour}
        />
      </div>

      {checks.length > 0 && (
        <table className="mt-2 w-full text-left text-[11px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-1 pr-2 font-medium">Time</th>
              <th className="py-1 pr-2 font-medium">PH</th>
              <th className="py-1 pr-2 font-medium">Cl₂ (ppm)</th>
              <th className="py-1 pr-2 font-medium">Transit (s)</th>
              <th className="py-1 pr-2 font-medium">Status</th>
              <th className="py-1 pr-2 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="py-1 pr-2 text-slate-600">
                  {c.recordedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="py-1 pr-2">{c.phLevel ?? "—"}</td>
                <td className="py-1 pr-2">{c.freeChlorinePpm ?? "—"}</td>
                <td className="py-1 pr-2">{c.fruitTransitSeconds ?? "—"}</td>
                <td className="py-1 pr-2">
                  {c.deviationOccurred == null ? (
                    "—"
                  ) : c.deviationOccurred ? (
                    <Badge color="red">Deviation</Badge>
                  ) : (
                    <Badge color="green">OK</Badge>
                  )}
                </td>
                <td className="py-1 pr-2 text-slate-500">{c.verifiedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form action={formAction} className="mt-2 space-y-2 border-t border-slate-100 pt-2">
        <input type="hidden" name="factoryId" value={factoryId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="shiftType" value={shiftType} />
        <FieldGroup label="Time (defaults to now)">
          <Input
            key={presetHour ?? "now"}
            name="recordedAt"
            type="datetime-local"
            defaultValue={defaultRecordedAt}
            className="px-1.5 py-1 text-xs"
          />
        </FieldGroup>
        <div className="grid grid-cols-3 gap-1.5">
          <FieldGroup label="PH">
            <Input name="phLevel" type="number" step="0.01" className="px-1.5 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Free Chlorine (ppm)">
            <Input name="freeChlorinePpm" type="number" step="0.01" className="px-1.5 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label="Fruit Transit (s)">
            <Input name="fruitTransitSeconds" type="number" step="1" className="px-1.5 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[11px] text-slate-700">
            <input type="checkbox" name="deviationOccurred" /> Deviation from standard occurred
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-700">
            <input type="checkbox" name="verifiedOk" defaultChecked /> Verified
          </label>
        </div>
        <FieldGroup label="Corrective action (if deviation)">
          <Input name="correctiveAction" className="px-1.5 py-1 text-xs" />
        </FieldGroup>
        <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-[11px]">
          {pending ? "Logging…" : "Log reading"}
        </Button>
        {currentUserLabel && <span className="ml-2 text-[11px] text-slate-400">as {currentUserLabel}</span>}
        {errorMessage && <p className="text-[11px] text-red-600">{errorMessage}</p>}
      </form>
    </div>
  );
}
