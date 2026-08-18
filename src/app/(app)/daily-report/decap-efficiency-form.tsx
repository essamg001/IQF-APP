"use client";

import { useActionState } from "react";
import { updateDecapEfficiencyAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function DecapEfficiencyForm({
  date,
  weightOutKg,
  calyxKg,
}: {
  date: string;
  weightOutKg: number | null;
  calyxKg: number | null;
}) {
  const [state, formAction, pending] = useActionState(updateDecapEfficiencyAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.dailyReport;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="date" value={date} />
      <FieldGroup label={dict.weightOutFieldLabel}>
        <Input name="weightOutKg" type="number" step="0.1" min="0" defaultValue={weightOutKg ?? ""} className="w-32" />
      </FieldGroup>
      <FieldGroup label={dict.calyxRemovedLabel}>
        <Input name="calyxKg" type="number" step="0.1" min="0" defaultValue={calyxKg ?? ""} className="w-32" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? fullDict.common.saving : fullDict.common.save}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
