"use client";

import { useActionState } from "react";
import { markOrderPaidAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function MarkPaidForm({ orderId }: { orderId: string }) {
  const boundAction = markOrderPaidAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.orders;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label={t.paidDateLabel}>
        <Input name="paidAt" type="date" required defaultValue={today} className="w-40" />
      </FieldGroup>
      <FieldGroup label={t.paymentReferenceLabel}>
        <Input name="paymentReference" placeholder={t.paymentReferencePlaceholder} className="w-56" />
      </FieldGroup>
      <ConfirmSubmitButton
        confirmMessage={t.markPaidConfirm.replace("{date}", today)}
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 disabled:pointer-events-none"
      >
        {pending ? dict.common.saving : t.markPaid}
      </ConfirmSubmitButton>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
