"use client";

import { useActionState } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

type ReviewAction = (
  requestId: string,
  prevState: string | undefined,
  formData: FormData
) => Promise<string | undefined>;

export function ReviewForm({ requestId, action }: { requestId: string; action: ReviewAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <FieldGroup label={dict.rejectionReasonLabel}>
        <Input name="rejectionReason" placeholder={dict.rejectionReasonPlaceholder} />
      </FieldGroup>
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="APPROVE"
          disabled={pending}
          className="bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {pending ? common.saving : dict.approve}
        </Button>
        <Button type="submit" name="decision" value="REJECT" variant="danger" disabled={pending}>
          {pending ? common.saving : dict.reject}
        </Button>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
