"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

type ConfirmAction = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

export function ConfirmLoadLineForm({ action }: { action: ConfirmAction }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;

  return (
    <form action={formAction}>
      <ConfirmSubmitButton
        confirmMessage="Confirm that no cartons or pallets exceed the container's marked load line (red line)? This is a physical visual check, not a formality -- cartons above the line block reefer airflow and can cause a temperature excursion in transit."
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? "Confirming…" : "Confirm — red line not exceeded"}
      </ConfirmSubmitButton>
      {errorMessage && <p className="mt-1 max-w-xs text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
