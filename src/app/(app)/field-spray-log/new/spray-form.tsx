"use client";

import { useActionState, useState } from "react";
import { createFieldSprayAction } from "../actions";
import { Input, FieldGroup, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Field } from "@prisma/client";

export function SprayForm({ fields }: { fields: Pick<Field, "id" | "name">[] }) {
  const [error, formAction, pending] = useActionState(createFieldSprayAction, undefined);
  const dict = useTranslations().fieldSprayLog;

  const [fieldName, setFieldName] = useState("");

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
          <Input name="chemicalName" required placeholder={dict.chemicalPlaceholder} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.sprayDateLabel}>
            <Input name="sprayDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
          <FieldGroup label={dict.noHarvestDaysLabel}>
            <Input name="noHarvestDays" type="number" min="0" step="1" defaultValue={12} required />
          </FieldGroup>
        </div>
        <FieldGroup label={dict.sprayedByLabel}>
          <Input name="sprayedByName" placeholder={dict.sprayedByPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.reasonLabel}>
          <Input name="reason" placeholder={dict.reasonPlaceholder} />
        </FieldGroup>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.complianceHeading}</p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <FieldGroup label={dict.phiLimitDaysLabel}>
              <Input name="phiLimitDays" type="number" min="0" step="1" />
            </FieldGroup>
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
