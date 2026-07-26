"use client";

import { useActionState, useMemo, useState } from "react";
import { createLotAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateLotNumber } from "@/lib/lotNumber";
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

  const [farmCode, setFarmCode] = useState("M4");
  const [shiftId, setShiftId] = useState(shifts[0]?.id ?? "");

  const selectedShift = shifts.find((s) => s.id === shiftId);
  const previewLotNumber = useMemo(() => {
    if (!farmCode || !selectedShift?.factory.code) return null;
    return generateLotNumber({
      farmCode: farmCode.trim().toUpperCase(),
      factoryCode: selectedShift.factory.code,
      date: selectedShift.date,
      shiftType: selectedShift.shiftType,
    });
  }, [farmCode, selectedShift]);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Farm Code">
            <Input
              name="farmCode"
              required
              placeholder="e.g. M4"
              value={farmCode}
              onChange={(e) => setFarmCode(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label="Shift">
            <Select name="shiftId" required value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {format(s.date, "dd MMM yyyy")} — {s.factory.name} — {s.shiftType === "DAY" ? "Shift 1 (Day)" : "Shift 2 (Night)"}
                </option>
              ))}
            </Select>
          </FieldGroup>
        </div>
        {previewLotNumber && (
          <p className="text-xs text-slate-500">
            Lot number will be <span className="font-mono font-medium text-slate-700">{previewLotNumber}</span>
          </p>
        )}
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
