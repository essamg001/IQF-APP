"use client";

import { useActionState } from "react";
import { resolveShiftHoldAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";

export function ResolveHoldForm({ shiftId }: { shiftId: string }) {
  const [state, formAction, pending] = useActionState(resolveShiftHoldAction.bind(null, shiftId), undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3 border-t border-red-100 pt-3">
      <FieldGroup label="Your name">
        <Input name="resolvedBy" required className="w-48" />
      </FieldGroup>
      <FieldGroup label="Resolution note (what further testing showed)">
        <Input name="resolutionNote" required className="w-96" />
      </FieldGroup>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
      <ConfirmSubmitButton
        confirmMessage="Release this hold? Every lot from this shift becomes shippable again."
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? "Releasing…" : "Release hold"}
      </ConfirmSubmitButton>
    </form>
  );
}
