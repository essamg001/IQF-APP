"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createContainerAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortInput } from "@/components/port-select";
import { CarrierInput } from "@/components/carrier-select";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Client, Order } from "@prisma/client";

type RoomSummary = { roomId: string; roomName: string; readyCount: number; target: number; palletIds: string[] } | null;

export function ContainerForm({
  orders,
  defaultOrderId,
  roomSummaryByOrder,
}: {
  orders: (Order & { client: Client })[];
  defaultOrderId?: string;
  roomSummaryByOrder: Record<string, RoomSummary>;
}) {
  const [error, formAction, pending] = useActionState(createContainerAction, undefined);
  const [selectedOrderId, setSelectedOrderId] = useState(defaultOrderId ?? "");
  const fullDict = useTranslations();
  const dict = fullDict.logistics;
  const FORMAT_LABEL: Record<string, string> = {
    WHOLE: fullDict.orders.formatWhole,
    SLICED: fullDict.orders.formatSliced,
    DICED: fullDict.orders.formatDiced,
  };
  const summary = selectedOrderId ? roomSummaryByOrder[selectedOrderId] : undefined;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={dict.orderLabel}>
          <Select
            name="orderId"
            required
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
          >
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

        {/* Confirms the right order was picked before the container even
            exists -- a wrong pick shows a location/count that immediately
            looks off, instead of only surfacing after commit. */}
        {selectedOrderId && (
          <div
            className={cn(
              "rounded-md border px-3 py-2 text-xs",
              !summary || summary.readyCount < summary.target
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-blue-200 bg-blue-50 text-blue-900"
            )}
          >
            {summary ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {(summary.readyCount >= summary.target
                    ? dict.orderPalletLocationSummaryReady
                    : dict.orderPalletLocationSummaryOnHold
                  )
                    .replace("{room}", summary.roomName)
                    .replace("{ready}", String(summary.readyCount))
                    .replace("{target}", String(summary.target))}
                </span>
                <LinkButton
                  href={`/storage/map/${summary.roomId}?highlight=${summary.palletIds.join(",")}&orderId=${selectedOrderId}`}
                  variant="secondary"
                  className="shrink-0 text-xs"
                >
                  {dict.previewOnStorageMap}
                </LinkButton>
              </div>
            ) : (
              <span>{dict.orderNoPalletsAllocatedYet}</span>
            )}
          </div>
        )}
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
