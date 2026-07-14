"use client";

import { useActionState, useState } from "react";
import { createClaimAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Client } from "@prisma/client";

type ContainerLine = {
  containerNumber: string;
  variety?: string;
  shippingLine?: string;
  cartonsPerContainer?: string;
  netWeight?: string;
  shipmentDate?: string;
  arrivalDate?: string;
  complaintDate?: string;
  sellingPricePerCarton?: string;
  shippingPrice?: string;
  lostCartons?: string;
  creditRequired?: string;
  claimPct?: string;
  claimAmount?: string;
  totalSales?: string;
};

const EMPTY_LINE: ContainerLine = { containerNumber: "" };

function ContainerLineCard({
  line,
  onChange,
  onRemove,
}: {
  line: ContainerLine;
  onChange: (next: ContainerLine) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof ContainerLine, value: string) => onChange({ ...line, [key]: value });

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <FieldGroup label="Container #">
          <Input value={line.containerNumber} onChange={(e) => set("containerNumber", e.target.value)} className="w-48" required />
        </FieldGroup>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <FieldGroup label="Variety">
          <Input value={line.variety ?? ""} onChange={(e) => set("variety", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Shipping line">
          <Input value={line.shippingLine ?? ""} onChange={(e) => set("shippingLine", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Cartons/container">
          <Input type="number" value={line.cartonsPerContainer ?? ""} onChange={(e) => set("cartonsPerContainer", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Net weight">
          <Input type="number" step="0.01" value={line.netWeight ?? ""} onChange={(e) => set("netWeight", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Shipment date">
          <Input type="date" value={line.shipmentDate ?? ""} onChange={(e) => set("shipmentDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Arrival date">
          <Input type="date" value={line.arrivalDate ?? ""} onChange={(e) => set("arrivalDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Complaint date">
          <Input type="date" value={line.complaintDate ?? ""} onChange={(e) => set("complaintDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Selling price/carton">
          <Input type="number" step="0.01" value={line.sellingPricePerCarton ?? ""} onChange={(e) => set("sellingPricePerCarton", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Shipping price">
          <Input type="number" step="0.01" value={line.shippingPrice ?? ""} onChange={(e) => set("shippingPrice", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Lost cartons">
          <Input type="number" value={line.lostCartons ?? ""} onChange={(e) => set("lostCartons", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Credit required">
          <Input type="number" step="0.01" value={line.creditRequired ?? ""} onChange={(e) => set("creditRequired", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Claim %">
          <Input type="number" step="0.01" value={line.claimPct ?? ""} onChange={(e) => set("claimPct", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Claim amount">
          <Input type="number" step="0.01" value={line.claimAmount ?? ""} onChange={(e) => set("claimAmount", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Total sales">
          <Input type="number" step="0.01" value={line.totalSales ?? ""} onChange={(e) => set("totalSales", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

export function ClaimForm({
  clients,
  defaultClientId,
  defaultContainerNumber,
}: {
  clients: Client[];
  defaultClientId?: string;
  defaultContainerNumber?: string;
}) {
  const [error, formAction, pending] = useActionState(createClaimAction, undefined);
  const [lines, setLines] = useState<ContainerLine[]>(
    defaultContainerNumber ? [{ containerNumber: defaultContainerNumber }] : []
  );

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Claim Header (CH08403)</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Client">
            <Select name="clientId" required defaultValue={defaultClientId ?? ""}>
              <option value="" disabled>
                Select a client
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Claim #">
            <Input name="claimNumber" />
          </FieldGroup>
          <FieldGroup label="Claim date">
            <Input name="claimDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="variety" />
          </FieldGroup>
          <FieldGroup label="Reason">
            <Select name="reason" required>
              <option value="QUALITY">Quality (below spec)</option>
              <option value="PACKAGING">Packaging</option>
              <option value="FOREIGN_MATERIAL">Foreign material</option>
              <option value="TRANSPORT">Transport (e.g. cooling failure)</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Severity">
            <Select name="severity" required>
              <option value="AMBER">Amber</option>
              <option value="RED">Red</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Claim value (USD)">
            <Input name="valueUsd" type="number" step="0.01" min="0" required />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Containers Complained About</h2>
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            Add container
          </Button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <ContainerLineCard
              key={i}
              line={line}
              onChange={(next) => setLines(lines.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
            />
          ))}
          {lines.length === 0 && <p className="text-sm text-slate-400">No containers added yet.</p>}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Weight Deduction (if applicable)</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Net weight — Magrabi (ton)">
            <Input name="weightMagrabiTon" type="number" step="0.001" />
          </FieldGroup>
          <FieldGroup label="Net weight received at client (ton)">
            <Input name="weightClientTon" type="number" step="0.001" />
          </FieldGroup>
          <FieldGroup label="Weight difference (kg)">
            <Input name="weightDifferenceKg" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="Weight difference %">
            <Input name="weightDifferencePct" type="number" step="0.01" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Pricing & Contract Context</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Client price">
            <Input name="clientPrice" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Shipping price / container">
            <Input name="shippingPricePerContainer" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Client farm gate before issue">
            <Input name="clientFarmGateBeforeIssue" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Client farm gate after issue">
            <Input name="clientFarmGateAfterIssue" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Total shipping price">
            <Input name="totalShippingPrice" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Price agreement">
            <Input name="priceAgreement" />
          </FieldGroup>
          <FieldGroup label="Payment terms">
            <Input name="paymentTerms" />
          </FieldGroup>
          <FieldGroup label="Contract with company">
            <Input name="contractWithCompany" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Claim Details & Quality Response</h2>
        <FieldGroup label="Claim details">
          <Input name="claimDetails" />
        </FieldGroup>
        <FieldGroup label="Quality response">
          <Input name="qualityResponse" />
        </FieldGroup>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Container Inspection</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="inspectionCompanySent" /> Was an inspection company sent
        </label>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Inspection company name">
            <Input name="inspectionCompanyName" />
          </FieldGroup>
          <FieldGroup label="Inspection company cost">
            <Input name="inspectionCompanyCost" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Inspection company report">
            <Input name="inspectionCompanyReport" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Financial Negotiation</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Amount requested from client">
            <Input name="amountRequestedFromClient" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Amount after negotiation">
            <Input name="amountAfterNegotiation" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Discount value">
            <Input name="discountValue" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Amount requested for approval">
            <Input name="amountRequestedForApproval" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Total shipment value">
            <Input name="totalShipmentValue" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Discount %">
            <Input name="discountPct" type="number" step="0.01" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Notes & Approvals</h2>
        <FieldGroup label="Other notes">
          <Input name="otherNotes" />
        </FieldGroup>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Account Manager">
            <Input name="accountManager" />
          </FieldGroup>
          <FieldGroup label="IT Manager">
            <Input name="itManager" />
          </FieldGroup>
          <FieldGroup label="Export Manager">
            <Input name="exportManager" />
          </FieldGroup>
          <FieldGroup label="Export Director">
            <Input name="exportDirector" />
          </FieldGroup>
          <FieldGroup label="Commercial Director">
            <Input name="commercialDirector" />
          </FieldGroup>
          <FieldGroup label="Chairman">
            <Input name="chairman" />
          </FieldGroup>
        </div>
      </Card>

      <input type="hidden" name="containersJson" value={JSON.stringify(lines)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "File claim"}
      </Button>
    </form>
  );
}
