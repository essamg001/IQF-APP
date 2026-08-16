"use client";

import { useActionState } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type ReviewAction = (
  requestId: string,
  prevState: string | undefined,
  formData: FormData
) => Promise<string | undefined>;

export function ReviewForm({ requestId, action }: { requestId: string; action: ReviewAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <FieldGroup label="Reason for rejection (only needed if rejecting)">
        <Input name="rejectionReason" placeholder="Why isn't this being approved?" />
      </FieldGroup>
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="APPROVE"
          disabled={pending}
          className="bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {pending ? "Saving…" : "Approve"}
        </Button>
        <Button type="submit" name="decision" value="REJECT" variant="danger" disabled={pending}>
          {pending ? "Saving…" : "Reject"}
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
