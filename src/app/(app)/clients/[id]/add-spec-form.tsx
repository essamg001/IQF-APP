"use client";

import { useActionState } from "react";
import { addClientSpecAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DEFECT_FIELDS } from "@/lib/validation/client";
import { useTranslations } from "@/lib/i18n/locale-context";

export function AddSpecForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(addClientSpecAction.bind(null, clientId), undefined);
  const isSuccess = state === "ok";
  const errorMessage = state && !isSuccess ? state : undefined;
  const dict = useTranslations().clients;

  return (
    <form action={formAction} key={isSuccess ? "reset" : "initial"} className="space-y-4">
      <FieldGroup label={dict.specNameLabel}>
        <Input name="specName" required placeholder={dict.specNamePlaceholder} className="w-80" />
      </FieldGroup>

      <div className="grid grid-cols-3 gap-3">
        <FieldGroup label={dict.gradeFieldLabel}>
          <Select name="grade" defaultValue="A">
            <option value="A">{dict.gradeA}</option>
            <option value="B">{dict.gradeBClass2}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.formatLabel}>
          <Select name="format" defaultValue="WHOLE">
            <option value="WHOLE">{dict.formatWhole}</option>
            <option value="SLICED">{dict.formatSliced}</option>
            <option value="DICED">{dict.formatDiced}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.sizeCaliberFieldLabel}>
          <Input name="sizeCaliber" />
        </FieldGroup>
        <FieldGroup label={dict.brixLabel}>
          <Input name="brix" placeholder={dict.brixPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.phLabel}>
          <Input name="ph" placeholder={dict.phPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.maxCfuLabel}>
          <Input name="maxCfuPerGram" type="number" step="1" min="0" placeholder={dict.maxCfuPlaceholder} />
        </FieldGroup>
      </div>

      <p className="text-xs font-medium text-slate-500">{dict.defectTolerancesHint}</p>
      <div className="grid grid-cols-4 gap-3">
        {DEFECT_FIELDS.map((f) => (
          <FieldGroup key={f.key} label={f.label}>
            <Input name={f.key} placeholder="*" />
          </FieldGroup>
        ))}
      </div>

      <FieldGroup label={dict.notesFieldLabel}>
        <Input name="notes" />
      </FieldGroup>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">{dict.specificationAdded}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.saving : dict.addSpecButton}
      </Button>
    </form>
  );
}
