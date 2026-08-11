"use client";

import { useActionState } from "react";
import { verifyCapaAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

export function VerifyCapaForm({ issueId, currentUserLabel }: { issueId: string; currentUserLabel: string | null }) {
  const boundAction = verifyCapaAction.bind(null, issueId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="space-y-2">
      <FieldGroup label="Verification notes (optional)">
        <Input name="verificationNotes" placeholder="e.g. Checked next 3 shipments, no repeat of the issue" />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={`Confirm as ${
          currentUserLabel ?? "yourself"
        }: you've checked the corrective action above and it actually stopped this issue recurring.`}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? "Saving…" : "Mark Verified"}
      </ConfirmSubmitButton>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
