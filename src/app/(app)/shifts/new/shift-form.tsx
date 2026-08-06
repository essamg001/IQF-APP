"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createShiftAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Factory } from "@prisma/client";

type EfficiencyLookupRow = {
  factoryId: string;
  date: string;
  shiftType: string;
  uptimeFrom: string | null;
  uptimeTo: string | null;
};

export function ShiftForm({
  factories,
  initial,
  efficiencyLookup,
}: {
  factories: Factory[];
  initial?: { factoryId?: string; shiftType?: string; date?: string };
  efficiencyLookup: EfficiencyLookupRow[];
}) {
  const [error, formAction, pending] = useActionState(createShiftAction, undefined);

  const options = useMemo(
    () =>
      factories.flatMap((f, i) =>
        (["DAY", "NIGHT"] as const).map((shiftType) => ({
          value: `${f.id}::${shiftType}`,
          factoryId: f.id,
          shiftType,
          label: `IQF${i + 1} — Shift ${shiftType === "DAY" ? "1 (Day)" : "2 (Night)"}`,
        }))
      ),
    [factories]
  );

  const prefilledValue = initial?.factoryId && initial?.shiftType ? `${initial.factoryId}::${initial.shiftType}` : undefined;
  const [selection, setSelection] = useState(
    (prefilledValue && options.some((o) => o.value === prefilledValue) ? prefilledValue : options[0]?.value) ?? ""
  );
  const [factoryId, shiftType] = selection.split("::");

  const [date, setDate] = useState(initial?.date ?? "");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  // Tracks whether the user has hand-edited a time field for the current
  // factory/date/shift combo, so a matching Daily Report uptime window can
  // prefill it without ever clobbering a deliberate edit.
  const touchedRef = useRef({ start: false, end: false });
  const lastKeyRef = useRef("");

  const efficiencyByKey = useMemo(() => {
    const m = new Map<string, EfficiencyLookupRow>();
    for (const row of efficiencyLookup) m.set(`${row.factoryId}__${row.date}__${row.shiftType}`, row);
    return m;
  }, [efficiencyLookup]);

  const key = `${factoryId}__${date}__${shiftType}`;
  const match = date ? efficiencyByKey.get(key) : undefined;

  useEffect(() => {
    if (key !== lastKeyRef.current) {
      // A fresh factory/date/shift combo -- start clean rather than leaving
      // the previous combo's times sitting in the fields, since those belong
      // to a different shift entirely.
      lastKeyRef.current = key;
      touchedRef.current = { start: false, end: false };
      setStartTime(match?.uptimeFrom ?? "");
      setEndTime(match?.uptimeTo ?? "");
      return;
    }
    if (match?.uptimeFrom && !touchedRef.current.start) setStartTime(match.uptimeFrom);
    if (match?.uptimeTo && !touchedRef.current.end) setEndTime(match.uptimeTo);
  }, [key, match]);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <input type="hidden" name="factoryId" value={factoryId ?? ""} />
        <input type="hidden" name="shiftType" value={shiftType ?? ""} />
        <FieldGroup label="Shift">
          <Select value={selection} onChange={(e) => setSelection(e.target.value)} required>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Date">
          <Input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Start time">
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
          <FieldGroup label="End time">
            <Input
              name="endTime"
              type="time"
              required
              value={endTime}
              onChange={(e) => {
                touchedRef.current.end = true;
                setEndTime(e.target.value);
              }}
            />
          </FieldGroup>
        </div>
        {match && (match.uptimeFrom || match.uptimeTo) && (
          <p className="text-xs text-slate-500">
            Prefilled from this shift&apos;s line uptime in Daily Report — edit if the actual start/end differs.
          </p>
        )}
        <FieldGroup label="Number of workers">
          <Input name="workerCount" type="number" min="1" required />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log shift"}
        </Button>
      </Card>
    </form>
  );
}
