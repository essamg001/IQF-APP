"use client";

import { useActionState, useMemo, useState } from "react";
import { createLotAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateLotNumber } from "@/lib/lotNumber";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Field } from "@prisma/client";

function parseLocalDateOnly(dateStr: string): Date | null {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  return isNaN(d.getTime()) ? null : d;
}

export function LotForm({
  factoryId,
  factoryCode,
  date,
  shiftType,
  fields,
  suggestedFieldNames,
}: {
  factoryId: string;
  factoryCode: string | null;
  date: string;
  shiftType: "DAY" | "NIGHT";
  fields: Field[];
  suggestedFieldNames: string[];
}) {
  const [error, formAction, pending] = useActionState(createLotAction, undefined);
  const dict = useTranslations().production;

  const [farmCode, setFarmCode] = useState("M4");
  const [checkedFields, setCheckedFields] = useState<Set<string>>(new Set(suggestedFieldNames));
  const [extraFieldName, setExtraFieldName] = useState("");
  const [extraFields, setExtraFields] = useState<string[]>([]);

  const previewLotNumber = useMemo(() => {
    const parsedDate = parseLocalDateOnly(date);
    if (!farmCode || !parsedDate || !factoryCode) return null;
    return generateLotNumber({ farmCode: farmCode.trim().toUpperCase(), factoryCode, date: parsedDate, shiftType });
  }, [farmCode, date, factoryCode, shiftType]);

  const allFieldNames = [...checkedFields, ...extraFields];

  function toggleField(name: string) {
    setCheckedFields((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function addExtraField() {
    const name = extraFieldName.trim();
    if (!name) return;
    if (!extraFields.some((f) => f.toLowerCase() === name.toLowerCase()) && !checkedFields.has(name)) {
      setExtraFields((prev) => [...prev, name]);
    }
    setExtraFieldName("");
  }

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <input type="hidden" name="factoryId" value={factoryId} />
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="shiftType" value={shiftType} />
        {allFieldNames.map((name) => (
          <input key={name} type="hidden" name="fieldNames" value={name} />
        ))}

        <FieldGroup label={dict.farmCodeLabel}>
          <Input
            name="farmCode"
            required
            placeholder={dict.farmCodePlaceholder}
            value={farmCode}
            onChange={(e) => setFarmCode(e.target.value)}
          />
        </FieldGroup>

        {previewLotNumber && (
          <p className="text-xs text-slate-500">
            {dict.lotNumberWillBe.split("{number}")[0]}
            <span className="font-mono font-medium text-slate-700">{previewLotNumber}</span>
            {dict.lotNumberWillBe.split("{number}")[1]}
          </p>
        )}

        <FieldGroup label={dict.fieldsChecklistLabel}>
          <p className="text-xs text-slate-500">{dict.fieldsChecklistHint}</p>
          {suggestedFieldNames.length === 0 && (
            <p className="mt-1 text-xs font-medium text-amber-600">{dict.noFieldsForShiftYet}</p>
          )}
          <div className="mt-2 space-y-1.5">
            {suggestedFieldNames.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={checkedFields.has(name)} onChange={() => toggleField(name)} />
                {name}
              </label>
            ))}
            {extraFields.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked
                  onChange={() => setExtraFields((prev) => prev.filter((f) => f !== name))}
                />
                {name}
              </label>
            ))}
          </div>

          <div className="mt-3 flex items-end gap-2">
            <div className="flex-1">
              <FieldGroup label={dict.addAnotherFieldLabel}>
                <Input
                  list="field-suggestions"
                  placeholder={dict.addAnotherFieldPlaceholder}
                  value={extraFieldName}
                  onChange={(e) => setExtraFieldName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExtraField();
                    }
                  }}
                />
                <datalist id="field-suggestions">
                  {fields.map((f) => (
                    <option key={f.id} value={f.name} />
                  ))}
                </datalist>
              </FieldGroup>
            </div>
            <Button type="button" variant="secondary" onClick={addExtraField}>
              {dict.addFieldButton}
            </Button>
          </div>
          {extraFieldName.trim() &&
            !fields.some((f) => f.name.toLowerCase() === extraFieldName.trim().toLowerCase()) && (
              <p className="mt-1 text-xs font-medium text-amber-600">
                {dict.noExistingFieldMatch.replace("{name}", extraFieldName.trim())}
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

        {allFieldNames.length === 0 && <p className="text-sm text-red-600">{dict.atLeastOneFieldRequired}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending || allFieldNames.length === 0}>
          {pending ? dict.saving : dict.logLot}
        </Button>
      </Card>
    </form>
  );
}
