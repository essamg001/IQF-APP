"use client";

import { useActionState, useState } from "react";
import { createArrivalCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ArrivalInspectionForm() {
  const [state, formAction, pending] = useActionState(createArrivalCheckAction, undefined);

  // Delivery header fields carry over between consecutive samples from the
  // same truck; only the per-pallet fields (in SampleFields below) reset.
  const [source, setSource] = useState("");
  const [farmCode, setFarmCode] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [receiptNoteNo, setReceiptNoteNo] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery</h2>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Farm / Source">
            <Input name="rawMaterialSource" value={source} onChange={(e) => setSource(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Farm Code">
            <Input name="farmCode" value={farmCode} onChange={(e) => setFarmCode(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Transport Vehicle No.">
            <Input name="transportVehicleNo" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Receipt Note No.">
            <Input name="receiptNoteNo" value={receiptNoteNo} onChange={(e) => setReceiptNoteNo(e.target.value)} />
          </FieldGroup>
        </div>
      </Card>

      {/* Remounts (resetting whole-delivery/decision/inputs to defaults) whenever a new save succeeds. */}
      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <SubmitButton pending={pending} />
    </form>
  );
}

function SampleFields() {
  const [wholeDelivery, setWholeDelivery] = useState(false);
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");

  return (
    <Card className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          name="appliesToWholeDelivery"
          checked={wholeDelivery}
          onChange={(e) => setWholeDelivery(e.target.checked)}
        />
        Reject the entire delivery (skip pallet-by-pallet detail)
      </label>

      {!wholeDelivery && (
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Pallet / Sample Ref.">
            <Input name="sampleNo" required={!wholeDelivery} />
          </FieldGroup>
          <FieldGroup label="Fruit Size Caliber">
            <Input name="sizeCaliber" placeholder="25-40mm" />
          </FieldGroup>
          <FieldGroup label="Number of Boxes">
            <Input name="numberOfBoxesReceived" type="number" />
          </FieldGroup>
          <FieldGroup label="Crate Weight (kg)">
            <Input name="crateWeightKg" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="Brix">
            <Input name="brix" type="number" step="0.1" required={!wholeDelivery} />
          </FieldGroup>
          <FieldGroup label="Fruit Color (%)">
            <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Internal Quality (%)">
            <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Mould (%)">
            <Input name="mouldPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Skin Damage (%)">
            <Input name="skinDamagePct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Decision">
          <Select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
            <option value="ACCEPTED">Accept</option>
            <option value="REJECTED">Reject</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={decision === "REJECTED" ? "Reason for rejection" : "Notes (optional)"}>
          <Input name="notes" required={decision === "REJECTED" && wholeDelivery} />
        </FieldGroup>
      </div>
    </Card>
  );
}

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Log sample"}
    </Button>
  );
}
