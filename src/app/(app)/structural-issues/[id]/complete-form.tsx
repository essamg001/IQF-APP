"use client";

import { useActionState } from "react";
import { completeStructuralIssueAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function CompleteForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(completeStructuralIssueAction.bind(null, issueId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.structuralIssues;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <FieldGroup label={t.completionNotes}>
        <Input name="completionNotes" required placeholder={t.completeFormNotesPlaceholder} />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={t.markCompletedConfirm}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.common.saving : t.markCompleted}
      </ConfirmSubmitButton>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
