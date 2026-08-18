"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

type ConfirmAction = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

export function ChecklistItemConfirmForm({
  action,
  confirmMessage,
  buttonLabel,
}: {
  action: ConfirmAction;
  confirmMessage: string;
  buttonLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const dict = useTranslations().logistics;

  return (
    <form action={formAction}>
      <ConfirmSubmitButton
        confirmMessage={confirmMessage}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.confirming : buttonLabel}
      </ConfirmSubmitButton>
      {errorMessage && <p className="mt-1 max-w-xs text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
