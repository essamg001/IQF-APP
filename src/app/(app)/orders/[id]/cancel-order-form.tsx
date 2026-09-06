"use client";

import { useActionState, useRef } from "react";
import { cancelOrderAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const boundAction = cancelOrderAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const formRef = useRef<HTMLFormElement>(null);
  const dict = useTranslations();
  const t = dict.orders;

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label={t.cancelOrderReasonLabel}>
        <Input name="cancellationReason" required placeholder={t.cancelOrderReasonPlaceholder} className="w-64" />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={t.cancelOrderConfirm}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-red-300 px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.common.saving : t.cancelOrder}
      </ConfirmSubmitButton>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
