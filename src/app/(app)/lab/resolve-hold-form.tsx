"use client";

import { useActionState } from "react";
import { resolveShiftHoldAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ResolveHoldForm({ shiftId }: { shiftId: string }) {
  const [state, formAction, pending] = useActionState(resolveShiftHoldAction.bind(null, shiftId), undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const dict = useTranslations().lab;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3 border-t border-red-100 pt-3">
      <FieldGroup label={dict.yourNameLabel}>
        <Input name="resolvedBy" required className="w-48" />
      </FieldGroup>
      <FieldGroup label={dict.resolutionNoteLabel}>
        <Input name="resolutionNote" required className="w-96" />
      </FieldGroup>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
      <ConfirmSubmitButton
        confirmMessage={dict.releaseHoldConfirm}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.releasing : dict.releaseHold}
      </ConfirmSubmitButton>
    </form>
  );
}
