"use client";

import { useActionState, useMemo, useState } from "react";
import { createShiftAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Factory } from "@prisma/client";

export function ShiftForm({
  factories,
  initial,
}: {
  factories: Factory[];
  initial?: { factoryId?: string; shiftType?: string; date?: string };
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
          <Input name="date" type="date" required defaultValue={initial?.date} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Start time">
            <Input name="startTime" type="time" required />
          </FieldGroup>
          <FieldGroup label="End time">
            <Input name="endTime" type="time" required />
          </FieldGroup>
        </div>
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
