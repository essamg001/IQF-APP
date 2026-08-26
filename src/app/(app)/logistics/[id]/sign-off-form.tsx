"use client";

import { useActionState, useState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

type SignOffAction = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

export function SignOffForm({
  action,
  confirmMessage,
  pendingPalletCount,
}: {
  action: SignOffAction;
  confirmMessage: string;
  // > 0 means this order still has pallets not yet loaded into any
  // container -- the server-side gate (unshippedAllocationMessage) blocks
  // sign-off unless this checkbox is submitted checked, so the acknowledgment
  // has to actually be rendered here, not just implied by the count.
  pendingPalletCount: number;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [acknowledged, setAcknowledged] = useState(false);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const dict = useTranslations().logistics;

  return (
    <form action={formAction}>
      {pendingPalletCount > 0 && (
        <label className="mb-2 flex items-start gap-2 text-xs text-amber-700">
          <input
            type="checkbox"
            name="confirmRemainderElsewhere"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300"
          />
          <span>{dict.confirmRemainderElsewhereLabel.replace("{count}", String(pendingPalletCount))}</span>
        </label>
      )}
      <ConfirmSubmitButton
        confirmMessage={confirmMessage}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.signing : dict.signOff}
      </ConfirmSubmitButton>
      {errorMessage && <p className="mt-1 max-w-xs text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
