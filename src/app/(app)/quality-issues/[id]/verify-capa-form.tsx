"use client";

import { useActionState } from "react";
import { verifyCapaAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function VerifyCapaForm({ issueId, currentUserLabel }: { issueId: string; currentUserLabel: string | null }) {
  const boundAction = verifyCapaAction.bind(null, issueId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().qualityIssues;

  return (
    <form action={formAction} className="space-y-2">
      <FieldGroup label={dict.verificationNotesLabel}>
        <Input name="verificationNotes" placeholder={dict.verificationNotesPlaceholder} />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={dict.verifyConfirm.replace("{name}", currentUserLabel ?? dict.yourself)}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.saving : dict.markVerified}
      </ConfirmSubmitButton>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
