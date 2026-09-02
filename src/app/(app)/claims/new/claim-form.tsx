"use client";

import { useActionState, useState } from "react";
import { createClaimAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
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
  showPricing,
}: {
  line: ContainerLine;
  onChange: (next: ContainerLine) => void;
  onRemove: () => void;
  showPricing: boolean;
}) {
  const { claims: dict, common } = useTranslations();
  const set = (key: keyof ContainerLine, value: string) => onChange({ ...line, [key]: value });

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <FieldGroup label={dict.colContainerNumber}>
          <Input value={line.containerNumber} onChange={(e) => set("containerNumber", e.target.value)} className="w-48" required />
        </FieldGroup>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          {common.remove}
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <FieldGroup label={common.variety}>
          <Input value={line.variety ?? ""} onChange={(e) => set("variety", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.colShippingLine}>
          <Input value={line.shippingLine ?? ""} onChange={(e) => set("shippingLine", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formCartonsPerContainer}>
          <Input type="number" value={line.cartonsPerContainer ?? ""} onChange={(e) => set("cartonsPerContainer", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formNetWeight}>
          <Input type="number" step="0.01" value={line.netWeight ?? ""} onChange={(e) => set("netWeight", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formShipmentDate}>
          <Input type="date" value={line.shipmentDate ?? ""} onChange={(e) => set("shipmentDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formArrivalDate}>
          <Input type="date" value={line.arrivalDate ?? ""} onChange={(e) => set("arrivalDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formComplaintDate}>
          <Input type="date" value={line.complaintDate ?? ""} onChange={(e) => set("complaintDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.formLostCartons}>
          <Input type="number" value={line.lostCartons ?? ""} onChange={(e) => set("lostCartons", e.target.value)} />
        </FieldGroup>
        {showPricing && (
          <>
            <FieldGroup label={dict.formSellingPricePerCarton}>
              <Input type="number" step="0.01" value={line.sellingPricePerCarton ?? ""} onChange={(e) => set("sellingPricePerCarton", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={dict.formShippingPrice}>
              <Input type="number" step="0.01" value={line.shippingPrice ?? ""} onChange={(e) => set("shippingPrice", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={dict.formCreditRequired}>
              <Input type="number" step="0.01" value={line.creditRequired ?? ""} onChange={(e) => set("creditRequired", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={dict.colClaimPct}>
              <Input type="number" step="0.01" value={line.claimPct ?? ""} onChange={(e) => set("claimPct", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={dict.colClaimAmount}>
              <Input type="number" step="0.01" value={line.claimAmount ?? ""} onChange={(e) => set("claimAmount", e.target.value)} />
            </FieldGroup>
            <FieldGroup label={dict.formTotalSales}>
              <Input type="number" step="0.01" value={line.totalSales ?? ""} onChange={(e) => set("totalSales", e.target.value)} />
            </FieldGroup>
          </>
        )}
      </div>
    </div>
  );
}

export function ClaimForm({
  clients,
  defaultClientId,
  defaultContainerNumber,
  showPricing,
}: {
  clients: Client[];
  defaultClientId?: string;
  defaultContainerNumber?: string;
  showPricing: boolean;
}) {
  const [error, formAction, pending] = useActionState(createClaimAction, undefined);
  const [lines, setLines] = useState<ContainerLine[]>(
    defaultContainerNumber ? [{ containerNumber: defaultContainerNumber }] : []
  );
  const { claims: dict, common, orders } = useTranslations();

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.claimHeaderTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={orders.colClient}>
            <Select name="clientId" required defaultValue={defaultClientId ?? ""}>
              <option value="" disabled>
                {dict.selectClient}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.colClaimNumber}>
            <Input name="claimNumber" />
          </FieldGroup>
          <FieldGroup label={dict.formClaimDate}>
            <Input name="claimDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
          <FieldGroup label={common.variety}>
            <Input name="variety" />
          </FieldGroup>
          <FieldGroup label={dict.colReason}>
            <Select name="reason" required>
              <option value="QUALITY">{dict.reasonQualityOption}</option>
              <option value="PACKAGING">{orders.claimReasonPackaging}</option>
              <option value="FOREIGN_MATERIAL">{dict.reasonForeignMaterialOption}</option>
              <option value="TRANSPORT">{dict.reasonTransportOption}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.colSeverity}>
            <Select name="severity" required>
              <option value="AMBER">{dict.severityAmberOption}</option>
              <option value="RED">{dict.severityRedOption}</option>
            </Select>
          </FieldGroup>
          {showPricing && (
            <FieldGroup label={dict.formClaimValue}>
              <Input name="valueUsd" type="number" step="0.01" min="0" required />
            </FieldGroup>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.containersComplainedTitle}</h2>
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            {dict.addContainer}
          </Button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <ContainerLineCard
              key={i}
              line={line}
              onChange={(next) => setLines(lines.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
              showPricing={showPricing}
            />
          ))}
          {lines.length === 0 && <p className="text-sm text-slate-400">{dict.noContainersAddedYet}</p>}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.weightDeductionTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.formWeightMagrabiTon}>
            <Input name="weightMagrabiTon" type="number" step="0.001" />
          </FieldGroup>
          <FieldGroup label={dict.formWeightClientTon}>
            <Input name="weightClientTon" type="number" step="0.001" />
          </FieldGroup>
          <FieldGroup label={dict.formWeightDifferenceKg}>
            <Input name="weightDifferenceKg" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label={dict.rowWeightDifferencePct}>
            <Input name="weightDifferencePct" type="number" step="0.01" />
          </FieldGroup>
        </div>
      </Card>

      {showPricing && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{dict.pricingContractTitle}</h2>
          <div className="grid grid-cols-4 gap-3">
            <FieldGroup label={dict.formClientPrice}>
              <Input name="clientPrice" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.formShippingPricePerContainer}>
              <Input name="shippingPricePerContainer" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.formClientFarmGateBefore}>
              <Input name="clientFarmGateBeforeIssue" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.formClientFarmGateAfter}>
              <Input name="clientFarmGateAfterIssue" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.formTotalShippingPrice}>
              <Input name="totalShippingPrice" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.formPriceAgreement}>
              <Input name="priceAgreement" />
            </FieldGroup>
            <FieldGroup label={dict.formPaymentTerms}>
              <Input name="paymentTerms" />
            </FieldGroup>
            <FieldGroup label={dict.formContractWithCompany}>
              <Input name="contractWithCompany" />
            </FieldGroup>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.claimDetailsQualityTitle}</h2>
        <FieldGroup label={dict.formClaimDetails}>
          <Input name="claimDetails" />
        </FieldGroup>
        <FieldGroup label={dict.qualityResponseLabel}>
          <Input name="qualityResponse" />
        </FieldGroup>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.containerInspectionTitle}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="inspectionCompanySent" /> {dict.wasInspectionSent}
        </label>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.formInspectionCompanyName}>
            <Input name="inspectionCompanyName" />
          </FieldGroup>
          {showPricing && (
            <FieldGroup label={dict.formInspectionCompanyCost}>
              <Input name="inspectionCompanyCost" type="number" step="0.01" />
            </FieldGroup>
          )}
          <FieldGroup label={dict.formInspectionCompanyReport}>
            <Input name="inspectionCompanyReport" />
          </FieldGroup>
        </div>
      </Card>

      {showPricing && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{dict.financialNegotiationTitle}</h2>
          <div className="grid grid-cols-3 gap-3">
            <FieldGroup label={dict.rowAmountRequestedFromClient}>
              <Input name="amountRequestedFromClient" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.rowAmountAfterNegotiation}>
              <Input name="amountAfterNegotiation" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.rowDiscountValue}>
              <Input name="discountValue" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.rowAmountRequestedForApproval}>
              <Input name="amountRequestedForApproval" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.rowTotalShipmentValue}>
              <Input name="totalShipmentValue" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label={dict.rowDiscountPct}>
              <Input name="discountPct" type="number" step="0.01" />
            </FieldGroup>
          </div>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.notesApprovalsTitle}</h2>
        <FieldGroup label={dict.formOtherNotes}>
          <Input name="otherNotes" />
        </FieldGroup>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.rowAccountManager}>
            <Input name="accountManager" />
          </FieldGroup>
          <FieldGroup label={dict.rowItManager}>
            <Input name="itManager" />
          </FieldGroup>
          <FieldGroup label={dict.rowExportManager}>
            <Input name="exportManager" />
          </FieldGroup>
          <FieldGroup label={dict.rowExportDirector}>
            <Input name="exportDirector" />
          </FieldGroup>
          <FieldGroup label={dict.rowCommercialDirector}>
            <Input name="commercialDirector" />
          </FieldGroup>
          <FieldGroup label={dict.rowChairman}>
            <Input name="chairman" />
          </FieldGroup>
        </div>
      </Card>

      <input type="hidden" name="containersJson" value={JSON.stringify(lines)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? common.saving : dict.fileClaimButton}
      </Button>
    </form>
  );
}
