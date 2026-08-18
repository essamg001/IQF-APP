"use client";

import { useActionState } from "react";
import { addPersonalItemAuthorizationAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function AuthorizationForm() {
  const [state, formAction, pending] = useActionState(addPersonalItemAuthorizationAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.personalItems;

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-3 gap-3">
        <FieldGroup label={t.formName}>
          <Input name="name" required />
        </FieldGroup>
        <FieldGroup label={t.formJob}>
          <Input name="job" />
        </FieldGroup>
        <FieldGroup label={t.formWorkLocation}>
          <Input name="location" />
        </FieldGroup>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowsMobile" /> {t.itemMobile}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowsPens" /> {t.itemPens}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowsCalculator" /> {t.itemCalculator}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allowsOther" /> {t.itemOther}
        </label>
        <FieldGroup label={t.otherNoteOptional}>
          <Input name="otherNote" className="w-48" />
        </FieldGroup>
      </div>
      <FieldGroup label={t.notesOptional}>
        <Input name="notes" />
      </FieldGroup>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? dict.common.saving : t.add}
      </Button>
    </form>
  );
}
