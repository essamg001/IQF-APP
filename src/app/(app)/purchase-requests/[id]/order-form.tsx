"use client";

import { useActionState } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type OrderAction = (
  requestId: string,
  prevState: string | undefined,
  formData: FormData
) => Promise<string | undefined>;

export function OrderForm({ requestId, action }: { requestId: string; action: OrderAction }) {
  const [state, formAction, pending] = useActionState(action.bind(null, requestId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 grid grid-cols-2 gap-3">
      <FieldGroup label="Supplier">
        <Input name="supplierName" placeholder="Supplier name" />
      </FieldGroup>
      <FieldGroup label="Order reference / PO number">
        <Input name="orderReference" />
      </FieldGroup>
      <FieldGroup label="Cost (USD)">
        <Input name="costUsd" type="number" step="0.01" min="0" />
      </FieldGroup>
      <FieldGroup label="Expected delivery date">
        <Input name="expectedDeliveryDate" type="date" />
      </FieldGroup>
      <div className="col-span-2">
        {errorMessage && <p className="mb-2 text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Mark as Ordered"}
        </Button>
      </div>
    </form>
  );
}
