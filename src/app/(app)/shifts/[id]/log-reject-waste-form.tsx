"use client";

import { useActionState } from "react";
import { logShiftRejectWasteAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function LogRejectWasteForm({ shiftId }: { shiftId: string }) {
  const boundAction = logShiftRejectWasteAction.bind(null, shiftId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label="Rejected weight (kg)">
        <Input name="rejectedWeightKg" type="number" step="0.1" min="0.1" required className="w-36" />
      </FieldGroup>
      <FieldGroup label="Reason">
        <Input name="reason" required defaultValue="Below Grade B — removed on inspection belt, composted" className="w-80" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Logging…" : "Log to compost"}
      </Button>
      {state && state !== "ok" && <p className="w-full text-sm text-red-600">{state}</p>}
    </form>
  );
}
