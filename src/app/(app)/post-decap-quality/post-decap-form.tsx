"use client";

import { useActionState, useState } from "react";
import { createPostDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function Pct({ name, label }: { name: string; label: string }) {
  return (
    <FieldGroup label={label}>
      <Input name={name} type="number" step="0.1" min="0" max="100" />
    </FieldGroup>
  );
}

type FieldOption = { id: string; name: string };

export function PostDecapForm({
  fields,
  fieldByReceiptNote,
}: {
  fields: FieldOption[];
  fieldByReceiptNote: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(createPostDecapCheckAction, undefined);

  const [shiftNumber, setShiftNumber] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [receiptNoteNo, setReceiptNoteNo] = useState("");
  const [varietyName, setVarietyName] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

  const matchedFieldName = fieldByReceiptNote[receiptNoteNo.trim()] ?? "";

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery — Post-Decap Quality</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Receipt Note No.">
            <Input
              name="receiptNoteNo"
              value={receiptNoteNo}
              onChange={(e) => setReceiptNoteNo(e.target.value)}
              placeholder="Same as the pre-decap arrival"
            />
          </FieldGroup>
          <FieldGroup label="Field (auto-filled from Receipt Note, editable)">
            <FieldNameInput key={matchedFieldName || "manual"} defaultValue={matchedFieldName} fields={fields} />
          </FieldGroup>
          <FieldGroup label="Shift #">
            <Input name="shiftNumber" value={shiftNumber} onChange={(e) => setShiftNumber(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Transport Vehicle No.">
            <Input name="transportVehicleNo" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="varietyName" value={varietyName} onChange={(e) => setVarietyName(e.target.value)} />
          </FieldGroup>
        </div>
        {receiptNoteNo && !matchedFieldName && (
          <p className="text-xs text-amber-600">
            No pre-decap arrival found yet for this receipt note — type the field in manually.
          </p>
        )}
      </Card>

      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}

function FieldNameInput({ defaultValue, fields }: { defaultValue: string; fields: FieldOption[] }) {
  return (
    <>
      <Input
        name="fieldName"
        required
        list="field-suggestions"
        defaultValue={defaultValue}
        placeholder="e.g. MAFA 4 · ST1 · A1"
      />
      <datalist id="field-suggestions">
        {fields.map((f) => (
          <option key={f.id} value={f.name} />
        ))}
      </datalist>
    </>
  );
}

function SampleFields() {
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Sample Identity</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Sample No.">
            <Input name="sampleNo" required />
          </FieldGroup>
          <FieldGroup label="Sample Collection Time">
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Sample Weight (kg)">
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Product Temperature (°C)">
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="PH">
            <Input name="acidityPh" type="number" step="0.01" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Physical Measurements</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Fruit Size Caliber">
            <Input name="sizeCaliber" placeholder="25-40mm" />
          </FieldGroup>
          <FieldGroup label="Brix">
            <Input name="brix" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="Fruit Color (% of body)">
            <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Internal Quality (%)">
            <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Foreign Odor">
            <Input name="foreignOdor" placeholder="NIL" />
          </FieldGroup>
          <FieldGroup label="Foreign Taste">
            <Input name="foreignTaste" placeholder="NIL" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Decapping &amp; Defects</h2>
        <div className="grid grid-cols-4 gap-3">
          <Pct name="residualCalyxPct" label="Residual Calyx (not fully removed)" />
          <Pct name="decappingDamagePct" label="Decapping Damage" />
          <Pct name="mouldPct" label="Mould" />
          <Pct name="skinDamagePct" label="Skin Damage" />
          <Pct name="overmaturePct" label="Overmature" />
          <Pct name="oxidationPct" label="Oxidation" />
          <Pct name="insectsLarvaePct" label="Insects/Larvae" />
          <Pct name="foreignBodiesPct" label="Foreign Bodies" />
        </div>
        <p className="text-xs text-slate-400">Total defects is calculated automatically from the values above.</p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Decision — Acceptable / Unacceptable">
            <Select
              name="decision"
              required
              value={decision}
              onChange={(e) => setDecision(e.target.value as typeof decision)}
            >
              <option value="ACCEPTED">Acceptable</option>
              <option value="REJECTED">Unacceptable</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? "Reason" : "Reason (optional)"}>
            <Input
              name="notes"
              placeholder={decision === "REJECTED" ? "Why was it rejected?" : undefined}
              required={decision === "REJECTED"}
            />
          </FieldGroup>
        </div>
      </Card>
    </>
  );
}
