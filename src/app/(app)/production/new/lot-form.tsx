"use client";

import { useActionState, useMemo, useState } from "react";
import { createLotAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateLotNumber } from "@/lib/lotNumber";
import type { Factory, Field, ColdRoom } from "@prisma/client";

function parseLocalDateOnly(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

export function LotForm({
  factories,
  fields,
  coldRooms,
}: {
  factories: Factory[];
  fields: Field[];
  coldRooms: ColdRoom[];
}) {
  const [error, formAction, pending] = useActionState(createLotAction, undefined);

  const [farmCode, setFarmCode] = useState("M4");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const options = useMemo(
    () =>
      factories.flatMap((f, i) =>
        (["DAY", "NIGHT"] as const).map((shiftType) => ({
          value: `${f.id}::${shiftType}`,
          label: `IQF${i + 1} — Shift ${shiftType === "DAY" ? "1 (Day)" : "2 (Night)"}`,
          factoryCode: f.code,
        }))
      ),
    [factories]
  );
  const [selection, setSelection] = useState(options[0]?.value ?? "");
  const [factoryId, shiftType] = selection.split("::") as [string, "DAY" | "NIGHT"];
  const selectedOption = options.find((o) => o.value === selection);

  const previewLotNumber = useMemo(() => {
    const parsedDate = parseLocalDateOnly(date);
    if (!farmCode || !parsedDate || !selectedOption?.factoryCode) return null;
    return generateLotNumber({
      farmCode: farmCode.trim().toUpperCase(),
      factoryCode: selectedOption.factoryCode,
      date: parsedDate,
      shiftType,
    });
  }, [farmCode, date, selectedOption, shiftType]);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <input type="hidden" name="factoryId" value={factoryId ?? ""} />
        <input type="hidden" name="shiftType" value={shiftType ?? ""} />
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
          <FieldGroup label="Date">
            <Input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </FieldGroup>
        </div>
        <FieldGroup label="Factory & Shift">
          <Select value={selection} onChange={(e) => setSelection(e.target.value)} required>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FieldGroup>
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
