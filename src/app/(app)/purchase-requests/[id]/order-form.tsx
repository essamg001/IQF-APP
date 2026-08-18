"use client";

import { useActionState } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

type OrderAction = (
  requestId: string,
  prevState: string | undefined,
  formData: FormData
) => Promise<string | undefined>;

export function OrderForm({ requestId, action }: { requestId: string; action: OrderAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3">
      <FieldGroup label={dict.rowSupplier}>
        <Input name="supplierName" placeholder={dict.supplierPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.orderReferenceLabel}>
        <Input name="orderReference" />
      </FieldGroup>
      <FieldGroup label={dict.costUsdLabel}>
        <Input name="costUsd" type="number" step="0.01" min="0" />
      </FieldGroup>
      <FieldGroup label={dict.expectedDeliveryDateLabel}>
        <Input name="expectedDeliveryDate" type="date" />
      </FieldGroup>
      <div className="col-span-2">
        {errorMessage && <p className="mb-2 text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? common.saving : dict.markAsOrdered}
        </Button>
      </div>
    </form>
  );
}
