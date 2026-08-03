"use client";

import { useActionState } from "react";
import { logTemperatureAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { TemperatureLocation } from "@/lib/dailyReportLocations";

export function LogTemperatureForm({ factoryId, locations }: { factoryId: string; locations: TemperatureLocation[] }) {
  const [state, formAction, pending] = useActionState(logTemperatureAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="factoryId" value={factoryId} />
      <FieldGroup label="Location">
        <Select name="location" required className="w-56">
          <option value="">—</option>
          {locations.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Reading">
        <Input name="valueC" type="number" step="0.1" required className="w-28" />
      </FieldGroup>
      <FieldGroup label="Time (defaults to now)">
        <Input name="recordedAt" type="datetime-local" />
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" placeholder="optional" className="w-48" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Logging…" : "Log reading"}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
