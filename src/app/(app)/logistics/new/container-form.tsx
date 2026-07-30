"use client";

import { useActionState } from "react";
import { createContainerAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortInput } from "@/components/port-select";
import { CarrierInput } from "@/components/carrier-select";
import { FORMAT_LABEL } from "@/lib/format";
import type { Client, Order } from "@prisma/client";

export function ContainerForm({
  orders,
  defaultOrderId,
}: {
  orders: (Order & { client: Client })[];
  defaultOrderId?: string;
}) {
  const [error, formAction, pending] = useActionState(createContainerAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label="Order">
          <Select name="orderId" required defaultValue={defaultOrderId ?? ""}>
            <option value="" disabled>
              Select an order
            </option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.client.name} — Grade {o.grade}, {FORMAT_LABEL[o.format]}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Container number">
          <Input name="containerNumber" required placeholder="e.g. MSKU1234567" />
        </FieldGroup>
        <FieldGroup label="Carrier">
          <CarrierInput name="carrier" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Departure port">
            <PortInput name="departurePort" />
          </FieldGroup>
          <FieldGroup label="Destination port">
            <Input name="destinationPort" />
          </FieldGroup>
        </div>
        <FieldGroup label="Destination country">
          <Input name="destinationCountry" placeholder="e.g. Germany" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Departure date">
            <Input name="departureDate" type="date" />
          </FieldGroup>
          <FieldGroup label="Expected transit (days)">
            <Input name="expectedTransitDays" type="number" min="1" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Tracking provider (optional)">
            <Input name="trackingProvider" placeholder="e.g. ShipsGo" />
          </FieldGroup>
          <FieldGroup label="Tracking reference (optional)">
            <Input name="trackingRef" />
          </FieldGroup>
        </div>
        <p className="text-xs text-slate-500">
          Seal number and bill of lading number are usually only known once the carrier issues them after
          departure — add those from the container&apos;s own page once you have them.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Create container"}
        </Button>
      </Card>
    </form>
  );
}
