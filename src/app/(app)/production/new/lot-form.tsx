"use client";

import { useActionState } from "react";
import { createLotAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ShiftLog, Factory, Field, ColdRoom } from "@prisma/client";
import { format } from "date-fns";

export function LotForm({
  shifts,
  fields,
  coldRooms,
}: {
  shifts: (ShiftLog & { factory: Factory })[];
  fields: Field[];
  coldRooms: ColdRoom[];
}) {
  const [error, formAction, pending] = useActionState(createLotAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label="Lot number">
          <Input name="lotNumber" required placeholder="e.g. L-2026-0142" />
        </FieldGroup>
        <FieldGroup label="Shift">
          <Select name="shiftId" required>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {format(s.date, "dd MMM yyyy")} — {s.factory.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Field">
          <Input name="fieldName" list="field-suggestions" required placeholder="Type the field/farm name" />
          <datalist id="field-suggestions">
            {fields.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Grade">
            <Select name="grade" required>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Format">
            <Select name="format" required>
              <option value="WHOLE">Whole</option>
              <option value="SLICED">Sliced</option>
              <option value="DICED">Diced</option>
            </Select>
          </FieldGroup>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isEndOfDayGradeB" /> End-of-day Grade B run
        </label>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Number of pallets">
            <Input name="palletCount" type="number" min="1" required />
          </FieldGroup>
          <FieldGroup label="Cold room">
            <Select name="coldRoomId" required>
              {coldRooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>

        <p className="text-xs font-medium text-slate-500">
          Carton attributes (applied to all pallets generated from this lot)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Carton logo">
            <Input name="cartonLogo" />
          </FieldGroup>
          <FieldGroup label="Carton size">
            <Input name="cartonSize" />
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="variety" />
          </FieldGroup>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Log lot & generate pallets"}
        </Button>
      </Card>
    </form>
  );
}
