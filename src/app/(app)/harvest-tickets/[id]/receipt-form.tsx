"use client";

import { useActionState } from "react";
import { recordReceiptAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function ReceiptForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState(recordReceiptAction.bind(null, ticketId), undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Received Date">
          <Input name="receivedDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </FieldGroup>
        <FieldGroup label="Received Time">
          <Input name="receivedTime" type="datetime-local" />
        </FieldGroup>
        <FieldGroup label="Delivery Number">
          <Input name="deliveryNumber" />
        </FieldGroup>
        <FieldGroup label="Crates Received">
          <Input name="cratesReceived" type="number" step="1" />
        </FieldGroup>
        <FieldGroup label="Pallets Received">
          <Input name="palletsReceived" type="number" step="1" />
        </FieldGroup>
        <FieldGroup label="Gross Weight (kg)">
          <Input name="grossWeightKg" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Net Weight (kg)">
          <Input name="netWeightKg" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Electronic Weight Card No.">
          <Input name="electronicWeightCardNo" />
        </FieldGroup>
        <FieldGroup label="Product Temp (°C)">
          <Input name="productTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Optimum Temp (°C)">
          <Input name="optimumTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Cold Truck Temp (°C)">
          <Input name="coldTruckTempC" type="number" step="0.1" />
        </FieldGroup>
        <FieldGroup label="Received By">
          <Input name="receivedByName" required />
        </FieldGroup>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="acceptedAtPackhouse" /> Accepted at packhouse
      </label>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record Receipt"}
      </Button>
    </form>
  );
}
