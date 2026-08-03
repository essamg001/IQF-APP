"use client";

import { useActionState } from "react";
import { addDowntimeEventAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function DowntimeEntryForm({ factoryId, date }: { factoryId: string; date: string }) {
  const [state, formAction, pending] = useActionState(addDowntimeEventAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <FieldGroup label="Shift">
        <Select name="shiftType" required className="w-28">
          <option value="DAY">Shift 1</option>
          <option value="NIGHT">Shift 2</option>
        </Select>
      </FieldGroup>
      <FieldGroup label="From">
        <Input name="fromTime" type="time" required className="w-28" />
      </FieldGroup>
      <FieldGroup label="To">
        <Input name="toTime" type="time" required className="w-28" />
      </FieldGroup>
      <FieldGroup label="Reason">
        <Input name="reason" required placeholder="e.g. Line Washing" className="w-48" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Add"}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
