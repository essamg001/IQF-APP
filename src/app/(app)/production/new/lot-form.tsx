"use client";

import { useActionState, useMemo, useState } from "react";
import { createLotAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateLotNumber } from "@/lib/lotNumber";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory, Field } from "@prisma/client";

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
  recentFieldNames,
}: {
  factories: Factory[];
  fields: Field[];
  recentFieldNames: string[];
}) {
  const [error, formAction, pending] = useActionState(createLotAction, undefined);
  const dict = useTranslations().production;

  const [farmCode, setFarmCode] = useState("M4");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fieldName, setFieldName] = useState(recentFieldNames[0] ?? "");

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
          <FieldGroup label={dict.farmCodeLabel}>
            <Input
              name="farmCode"
              required
              placeholder={dict.farmCodePlaceholder}
              value={farmCode}
              onChange={(e) => setFarmCode(e.target.value)}
            />
          </FieldGroup>
          <FieldGroup label={dict.dateLabel}>
            <Input name="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </FieldGroup>
        </div>
        <FieldGroup label={dict.factoryShiftLabel}>
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
            {dict.lotNumberWillBe.split("{number}")[0]}
            <span className="font-mono font-medium text-slate-700">{previewLotNumber}</span>
            {dict.lotNumberWillBe.split("{number}")[1]}
          </p>
        )}
        <FieldGroup label={dict.fieldLabel}>
          <Input
            name="fieldName"
            list="field-suggestions"
            required
            placeholder={dict.fieldPlaceholder}
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
          />
          <datalist id="field-suggestions">
            {fields.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
          {fieldName.trim() &&
            !fields.some((f) => f.name.toLowerCase() === fieldName.trim().toLowerCase()) && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                {dict.noExistingFieldMatch.replace("{name}", fieldName.trim())}
              </p>
            )}
          {recentFieldNames.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {dict.autoFilledFromPostDecap}
              {recentFieldNames.length > 1 && (
                <>
                  {dict.alsoRecentPrefix}
                  {recentFieldNames.slice(1).map((name, i) => (
                    <span key={name}>
                      {i > 0 && ", "}
                      <button
                        type="button"
                        onClick={() => setFieldName(name)}
                        className="text-emerald-700 hover:underline"
                      >
                        {name}
                      </button>
                    </span>
                  ))}
                </>
              )}
            </p>
          )}
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.gradeLabelField}>
            <Select name="grade" required>
              <option value="A">{dict.gradeLabel.replace("{grade}", "A")}</option>
              <option value="B">{dict.gradeLabel.replace("{grade}", "B")}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.formatLabel}>
            <Select name="format" required>
              <option value="WHOLE">{dict.formatWhole}</option>
              <option value="SLICED">{dict.formatSliced}</option>
              <option value="DICED">{dict.formatDiced}</option>
            </Select>
          </FieldGroup>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isEndOfDayGradeB" /> {dict.endOfDayGradeBRun}
        </label>

        <p className="text-xs text-slate-500">{dict.palletsNotCreatedHereNote}</p>

        <p className="text-xs text-slate-500">{dict.autoShiftCreationNote}</p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.logLot}
        </Button>
      </Card>
    </form>
  );
}
