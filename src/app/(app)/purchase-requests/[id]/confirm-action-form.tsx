"use client";

import { useActionState } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

type ConfirmAction = (
  requestId: string,
  prevState: string | undefined,
  formData: FormData
) => Promise<string | undefined>;

export function ConfirmActionForm({
  requestId,
  action,
  confirmMessage,
  buttonLabel,
  withNotes = false,
}: {
  requestId: string;
  action: ConfirmAction;
  confirmMessage: string;
  buttonLabel: string;
  withNotes?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 space-y-3">
      {withNotes && (
        <FieldGroup label={dict.workingNotesLabel}>
          <Input name="workingNotes" placeholder={dict.workingNotesPlaceholder} />
        </FieldGroup>
      )}
      <ConfirmSubmitButton
        confirmMessage={confirmMessage}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? common.saving : buttonLabel}
      </ConfirmSubmitButton>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
