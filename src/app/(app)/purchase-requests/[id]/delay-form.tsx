"use client";

import { useActionState } from "react";
import { recordDeliveryDelayAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function DelayForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(recordDeliveryDelayAction.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3">
      <FieldGroup label={dict.revisedDeliveryDateLabel}>
        <Input name="revisedDeliveryDate" type="date" required />
      </FieldGroup>
      <FieldGroup label={dict.delayReasonLabel}>
        <Input name="delayReason" placeholder={dict.delayReasonPlaceholder} required />
      </FieldGroup>
      <div className="col-span-2">
        {errorMessage && <p className="mb-2 text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? common.saving : dict.recordDelay}
        </Button>
      </div>
    </form>
  );
}
