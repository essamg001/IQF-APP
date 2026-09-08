"use client";

import { useActionState, useMemo, useState } from "react";
import { createFieldSprayAction } from "../actions";
import { Input, Select, FieldGroup, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Field } from "@prisma/client";

const OTHER_VALUE = "__OTHER__";

type ChemicalOption = { id: string; commercialProductName: string; proposedPhiDays: string | null };

/** A clean whole number of days, or null for "NA"/anything else not safe to auto-apply -- mirrors actions.ts's parsePhiDays. */
function parsePhiDays(raw: string | null): number | null {
  return raw && /^\d+$/.test(raw.trim()) ? parseInt(raw.trim(), 10) : null;
}

export function SprayForm({
  fields,
  chemicalOptions,
}: {
  fields: Pick<Field, "id" | "name">[];
  chemicalOptions: ChemicalOption[];
}) {
  const [error, formAction, pending] = useActionState(createFieldSprayAction, undefined);
  const dict = useTranslations().fieldSprayLog;

  const [fieldName, setFieldName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [sprayDate, setSprayDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualNoHarvestDays, setManualNoHarvestDays] = useState(12);

  const selectedEntry = chemicalOptions.find((c) => c.id === selectedId);
  const isOther = selectedId === OTHER_VALUE;
  const isKnownWithPhi = !!selectedEntry && parsePhiDays(selectedEntry.proposedPhiDays) != null;
  // A known product with no usable PHI on file (e.g. a biological control
  // agent marked "NA") still locks the chemical name, but -- same as Other --
  // needs someone to enter the no-harvest period themselves.
  const needsManualDays = isOther || (!!selectedEntry && !isKnownWithPhi);

  const effectiveNoHarvestDays = isKnownWithPhi ? parsePhiDays(selectedEntry!.proposedPhiDays)! : manualNoHarvestDays;
  const clearDate = useMemo(() => {
    if (!sprayDate || !effectiveNoHarvestDays) return null;
    const d = new Date(sprayDate + "T00:00:00");
    d.setDate(d.getDate() + effectiveNoHarvestDays);
    return d;
  }, [sprayDate, effectiveNoHarvestDays]);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={dict.fieldLabel}>
          <Input
            name="fieldName"
            list="spray-field-suggestions"
            required
            placeholder={dict.fieldPlaceholder}
            value={fieldName}
            onChange={(e) => setFieldName(e.target.value)}
          />
          <datalist id="spray-field-suggestions">
            {fields.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
          {fieldName.trim() && !fields.some((f) => f.name.toLowerCase() === fieldName.trim().toLowerCase()) && (
            <p className="mt-1 text-xs font-medium text-amber-600">
              {dict.noExistingFieldMatch.replace("{name}", fieldName.trim())}
            </p>
          )}
        </FieldGroup>
        <FieldGroup label={dict.chemicalLabel}>
          <Select
            name="cropProtectionEntryId"
            required
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="" disabled>
              {dict.chemicalSelectPlaceholder}
            </option>
            {chemicalOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.commercialProductName}
              </option>
            ))}
            <option value={OTHER_VALUE}>{dict.chemicalOtherOption}</option>
          </Select>
        </FieldGroup>

        {isOther && (
          <FieldGroup label={dict.manualChemicalLabel}>
            <Input name="chemicalName" required placeholder={dict.chemicalPlaceholder} />
          </FieldGroup>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.sprayDateLabel}>
            <Input
              name="sprayDate"
              type="date"
              required
              value={sprayDate}
              onChange={(e) => setSprayDate(e.target.value)}
            />
          </FieldGroup>
          {needsManualDays ? (
            <FieldGroup label={dict.noHarvestDaysLabel}>
              <Input
                name="noHarvestDays"
                type="number"
                min="0"
                step="1"
                required
                value={manualNoHarvestDays}
                onChange={(e) => setManualNoHarvestDays(Number(e.target.value))}
              />
            </FieldGroup>
          ) : (
            <FieldGroup label={dict.noHarvestDaysLabel}>
              <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
                {isKnownWithPhi
                  ? dict.daysValue.replace("{days}", String(effectiveNoHarvestDays))
                  : dict.pickChemicalFirst}
              </div>
            </FieldGroup>
          )}
        </div>

        {selectedEntry && (
          <p className={isKnownWithPhi ? "text-xs text-emerald-700" : "text-xs font-medium text-amber-600"}>
            {isKnownWithPhi
              ? dict.phiAutoNote.replace("{days}", String(effectiveNoHarvestDays))
              : dict.phiNaNote.replace("{name}", selectedEntry.commercialProductName)}
          </p>
        )}

        {clearDate && (
          <p className="text-sm font-medium text-slate-700">
            {dict.clearDatePreview.replace(
              "{date}",
              clearDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })
            )}
          </p>
        )}

        <FieldGroup label={dict.sprayedByLabel}>
          <Input name="sprayedByName" placeholder={dict.sprayedByPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.reasonLabel}>
          <Input name="reason" placeholder={dict.reasonPlaceholder} />
        </FieldGroup>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.complianceHeading}</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <FieldGroup label={dict.leafComplianceLabel}>
              <Input name="leafCompliancePct" type="number" min="0" max="100" step="0.1" />
            </FieldGroup>
            <FieldGroup label={dict.globalGapComplianceLabel}>
              <Input name="globalGapCompliancePct" type="number" min="0" max="100" step="0.1" />
            </FieldGroup>
            <FieldGroup label={dict.nurtureComplianceLabel}>
              <Input name="nurtureCompliancePct" type="number" min="0" max="100" step="0.1" />
            </FieldGroup>
            <FieldGroup label={dict.fairtradeComplianceLabel}>
              <Input name="fairtradeCompliancePct" type="number" min="0" max="100" step="0.1" />
            </FieldGroup>
          </div>
        </div>

        <FieldGroup label={dict.notesLabel}>
          <Textarea name="notes" rows={2} />
        </FieldGroup>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.submitButton}
        </Button>
      </Card>
    </form>
  );
}
