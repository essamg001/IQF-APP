"use client";

import { useActionState } from "react";
import { addTemperatureReadingAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function AddTemperatureForm({ containerId }: { containerId: string }) {
  const boundAction = addTemperatureReadingAction.bind(null, containerId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label="Temperature (°C)">
        <Input name="temperatureC" type="number" step="0.1" required className="w-28" />
      </FieldGroup>
      <FieldGroup label="Recorded at">
        <Input name="recordedAt" type="datetime-local" />
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" placeholder="e.g. reported by forwarder" className="w-56" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Logging…" : "Log reading"}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
