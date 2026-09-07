"use client";

import { useActionState } from "react";
import { recordReceiptAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ReceiptForm({ ticketId, canSeeCost }: { ticketId: string; canSeeCost: boolean }) {
  const [state, formAction, pending] = useActionState(recordReceiptAction.bind(null, ticketId), undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.harvestTickets;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={dict.receivedDate}>
          <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </FieldGroup>
        <FieldGroup label={dict.receivedTime}>
          <Input name="receivedTime" type="datetime-local" />
        </FieldGroup>
        <FieldGroup label={dict.deliveryNumber}>
          <Input name="deliveryNumber" />
        </FieldGroup>
        <FieldGroup label={dict.cratesReceived}>
          <Input name="cratesReceived" type="number" step="1" />
        </FieldGroup>
        <FieldGroup label={dict.palletsReceived}>
          <Input name="palletsReceived" type="number" step="1" />
        </FieldGroup>
        <FieldGroup label={dict.grossWeightKg}>
          <Input name="grossWeightKg" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label={dict.netWeightKg}>
          <Input name="netWeightKg" type="number" step="0.1" />
        </FieldGroup>
        {canSeeCost && (
          <FieldGroup label={dict.pricePerKgUsd}>
            <Input name="pricePerKgUsd" type="number" step="0.001" min="0" />
          </FieldGroup>
        )}
        <FieldGroup label={dict.electronicWeightCardNo}>
          <Input name="electronicWeightCardNo" />
        </FieldGroup>
        <FieldGroup label={dict.productTempC}>
          <Input name="productTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label={dict.optimumTempC}>
          <Input name="optimumTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label={dict.coldTruckTempC}>
          <Input name="coldTruckTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label={dict.receivedBy}>
          <Input name="receivedByName" required />
        </FieldGroup>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="acceptedAtPackhouse" /> {dict.acceptedAtPackhouseCheckbox}
      </label>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? fullDict.common.saving : dict.recordReceipt}
      </Button>
    </form>
  );
}
