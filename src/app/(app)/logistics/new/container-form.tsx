"use client";

import { useActionState } from "react";
import { createContainerAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortInput } from "@/components/port-select";
import { CarrierInput } from "@/components/carrier-select";
import { FORMAT_LABEL } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Client, Order } from "@prisma/client";

export function ContainerForm({
  orders,
  defaultOrderId,
}: {
  orders: (Order & { client: Client })[];
  defaultOrderId?: string;
}) {
  const [error, formAction, pending] = useActionState(createContainerAction, undefined);
  const dict = useTranslations().logistics;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={dict.orderLabel}>
          <Select name="orderId" required defaultValue={defaultOrderId ?? ""}>
            <option value="" disabled>
              {dict.selectAnOrder}
            </option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} — {o.client.name} — {dict.gradeLabel.replace("{grade}", o.grade)}, {FORMAT_LABEL[o.format]}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.containerNumberLabel}>
          <Input name="containerNumber" required placeholder={dict.containerNumberPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.carrierLabel}>
          <CarrierInput name="carrier" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.loadTypeLabel}>
            <Select name="loadType" defaultValue="">
              <option value="">{dict.notYetDecided}</option>
              <option value="PALLETISED">{dict.palletisedOption}</option>
              <option value="UNPALLETISED">{dict.unpalletisedOption}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.bookingNumberLabel}>
            <Input name="bookingNumber" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.vesselNameLabel}>
            <Input name="vesselName" />
          </FieldGroup>
          <FieldGroup label={dict.voyageNumberLabel}>
            <Input name="voyageNumber" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.departurePortLabel}>
            <PortInput name="departurePort" />
          </FieldGroup>
          <FieldGroup label={dict.destinationPortLabel}>
            <Input name="destinationPort" />
          </FieldGroup>
        </div>
        <FieldGroup label={dict.destinationCountryLabel}>
          <Input name="destinationCountry" placeholder={dict.destinationCountryPlaceholder} />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.departureDateLabel}>
            <Input name="departureDate" type="date" />
          </FieldGroup>
          <FieldGroup label={dict.expectedTransitLabel}>
            <Input name="expectedTransitDays" type="number" min="1" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.trackingProviderLabel}>
            <Input name="trackingProvider" placeholder={dict.trackingProviderPlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.trackingRefLabel}>
            <Input name="trackingRef" />
          </FieldGroup>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="reeferConfirmed" defaultChecked />
          {dict.reeferConfirmedLabel}
        </label>
        <p className="text-xs text-slate-500">{dict.sealBolHint}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.createContainer}
        </Button>
      </Card>
    </form>
  );
}
