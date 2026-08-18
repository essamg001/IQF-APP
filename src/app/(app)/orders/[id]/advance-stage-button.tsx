"use client";

import { useActionState } from "react";
import { advanceOrderStageAction } from "../actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function AdvanceStageButton({ orderId, label }: { orderId: string; label: string }) {
  const [error, formAction, pending] = useActionState(advanceOrderStageAction.bind(null, orderId), undefined);
  const dict = useTranslations().orders;

  return (
    <div>
      <form action={formAction}>
        <ConfirmSubmitButton
          confirmMessage={dict.advanceConfirm.replace("{label}", label)}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? dict.advancing : dict.advanceTo.replace("{label}", label)}
        </ConfirmSubmitButton>
      </form>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
