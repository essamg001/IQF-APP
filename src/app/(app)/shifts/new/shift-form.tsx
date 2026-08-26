"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createShiftAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SHIFT_HOURS } from "@/lib/shiftHours";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

// Derived from the same fixed schedule (Day 7:00 AM-7:00 PM, Night 7:00 PM-
// 7:00 AM) used to build hourly coverage grids elsewhere, so it can't drift
// out of sync -- only the start time is known at shift-open, so that's all
// this prefills. The end time isn't asked for here at all: it fills in
// automatically once the day's Daily Report records this shift's line
// uptime (see updateLineEfficiencyAction), not from a guessed schedule.
const pad = (n: number) => String(n).padStart(2, "0");
const scheduledStart = (type: "DAY" | "NIGHT") => `${pad(SHIFT_HOURS[type][0])}:00`;

type EfficiencyLookupRow = {
  factoryId: string;
  date: string;
  shiftType: string;
  uptimeFrom: string | null;
  uptimeTo: string | null;
};

type FieldsLookupRow = { date: string; shiftType: string; fieldNames: string[] };

export function ShiftForm({
  factories,
  initial,
  efficiencyLookup,
  fieldsLookup,
}: {
  factories: Factory[];
  initial?: { factoryId?: string; shiftType?: string; date?: string };
  efficiencyLookup: EfficiencyLookupRow[];
  fieldsLookup: FieldsLookupRow[];
}) {
  const [error, formAction, pending] = useActionState(createShiftAction, undefined);
  const dict = useTranslations().shifts;

  const options = useMemo(
    () =>
      factories.flatMap((f, i) =>
        (["DAY", "NIGHT"] as const).map((shiftType) => ({
          value: `${f.id}::${shiftType}`,
          factoryId: f.id,
          shiftType,
          label: `IQF${i + 1} — ${shiftType === "DAY" ? dict.shift1Day : dict.shift2Night}`,
        }))
      ),
    [factories, dict]
  );

  const prefilledValue = initial?.factoryId && initial?.shiftType ? `${initial.factoryId}::${initial.shiftType}` : undefined;
  const [selection, setSelection] = useState(
    (prefilledValue && options.some((o) => o.value === prefilledValue) ? prefilledValue : options[0]?.value) ?? ""
  );
  const [factoryId, shiftType] = selection.split("::");

  const [date, setDate] = useState(initial?.date ?? "");
  const [startTime, setStartTime] = useState("");
  // Tracks whether the user has hand-edited start time for the current
  // factory/date/shift combo, so a matching Daily Report value can prefill
  // it without ever clobbering a deliberate edit. End time and worker count
  // aren't asked for here at all -- neither is known yet at shift-open time.
  // End time fills in automatically once Daily Report records this shift's
  // line uptime (see updateLineEfficiencyAction); worker count fills in the
  // same way once Daily Report's Labour Distribution is entered (see
  // updateDepartmentLabourEntryAction).
  const touchedRef = useRef({ start: false });
  const lastKeyRef = useRef("");

  const efficiencyByKey = useMemo(() => {
    const m = new Map<string, EfficiencyLookupRow>();
    for (const row of efficiencyLookup) m.set(`${row.factoryId}__${row.date}__${row.shiftType}`, row);
    return m;
  }, [efficiencyLookup]);

  const fieldsByKey = useMemo(() => {
    const m = new Map<string, FieldsLookupRow>();
    // Keyed by date+shiftType only, not factory -- decap is one shared
    // facility, so the same fields supply both factories for a given shift.
    for (const row of fieldsLookup) m.set(`${row.date}__${row.shiftType}`, row);
    return m;
  }, [fieldsLookup]);

  const key = `${factoryId}__${date}__${shiftType}`;
  const match = date ? efficiencyByKey.get(key) : undefined;
  const fieldsMatch = date ? fieldsByKey.get(`${date}__${shiftType}`) : undefined;

  // Start time defaults to the standard schedule (still editable) unless
  // Daily Report already happens to have this shift's uptime on file (e.g.
  // logging retroactively).
  const fallbackStart = useMemo(
    () => (shiftType === "DAY" || shiftType === "NIGHT" ? scheduledStart(shiftType) : ""),
    [shiftType]
  );

  useEffect(() => {
    if (key !== lastKeyRef.current) {
      // A fresh factory/date/shift combo -- start clean rather than leaving
      // the previous combo's value sitting in the field, since it belongs
      // to a different shift entirely.
      lastKeyRef.current = key;
      touchedRef.current = { start: false };
      setStartTime(match?.uptimeFrom ?? fallbackStart);
      return;
    }
    if (!touchedRef.current.start) setStartTime(match?.uptimeFrom ?? fallbackStart);
  }, [key, match, fallbackStart]);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <input type="hidden" name="factoryId" value={factoryId ?? ""} />
        <input type="hidden" name="shiftType" value={shiftType ?? ""} />
        <FieldGroup label={dict.shiftLabel}>
          <Select value={selection} onChange={(e) => setSelection(e.target.value)} required>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.dateLabel}>
          <Input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.startTimeLabel}>
          <Input
            name="startTime"
            type="time"
            required
            value={startTime}
            onChange={(e) => {
              touchedRef.current.start = true;
              setStartTime(e.target.value);
            }}
          />
        </FieldGroup>
        <p className="text-xs text-slate-500">{dict.endAndWorkersFromDailyReportNote}</p>

        {fieldsMatch && fieldsMatch.fieldNames.length > 0 && (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">{dict.fieldsSupplyingLabel}</p>
            <p className="mt-1 text-sm text-slate-700">{fieldsMatch.fieldNames.join(", ")}</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.logShiftButton}
        </Button>
      </Card>
    </form>
  );
}
