"use client";

import { useActionState } from "react";
import { reopenCleaningRecordAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ReopenCleaningForm({
  factoryId,
  date,
  shiftType,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
}) {
  const boundAction = reopenCleaningRecordAction.bind(null, factoryId, date, shiftType);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const dict = useTranslations().cleaningMode;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label={dict.reopenReasonLabel}>
        <Input name="reason" required className="w-80" placeholder={dict.reopenReasonPlaceholder} />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={dict.reopenConfirm}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-amber-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.reopening : dict.reopen}
      </ConfirmSubmitButton>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
