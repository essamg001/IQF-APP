"use client";

import { useActionState } from "react";
import { createShiftAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Factory } from "@prisma/client";

export function ShiftForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createShiftAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Factory">
            <Select name="factoryId" required>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Shift">
            <Select name="shiftType" required>
              <option value="DAY">Shift 1 (Day)</option>
              <option value="NIGHT">Shift 2 (Night)</option>
            </Select>
          </FieldGroup>
        </div>
        <FieldGroup label="Date">
          <Input name="date" type="date" required />
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
