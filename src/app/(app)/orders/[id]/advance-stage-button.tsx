"use client";

import { useActionState } from "react";
import { advanceOrderStageAction } from "../actions";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

export function AdvanceStageButton({ orderId, label }: { orderId: string; label: string }) {
  const [error, formAction, pending] = useActionState(advanceOrderStageAction.bind(null, orderId), undefined);

  return (
    <div>
      <form action={formAction}>
        <ConfirmSubmitButton
          confirmMessage={`Advance this order to "${label}"? There's no way to move it back a stage.`}
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
        >
          {pending ? "Advancing…" : `Advance to ${label}`}
        </ConfirmSubmitButton>
      </form>
      {error && <p className="mt-1 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
