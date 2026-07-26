"use client";

import { useActionState, useState } from "react";
import { createArrivalCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function Pct({ name, label, limit }: { name: string; label: string; limit: string }) {
  return (
    <FieldGroup label={`${label} (limit ${limit})`}>
      <Input name={name} type="number" step="0.1" min="0" max="100" />
    </FieldGroup>
  );
}

type TodaysCheck = { receiptNoteNo: string | null; appliesToWholeDelivery: boolean };

export function ArrivalInspectionForm({ todaysChecks }: { todaysChecks: TodaysCheck[] }) {
  const [state, formAction, pending] = useActionState(createArrivalCheckAction, undefined);

  // Shift/delivery header fields carry over between consecutive samples from
  // the same truck; only the per-pallet fields (in SampleFields below) reset.
  const [shiftNumber, setShiftNumber] = useState("");
  const [source, setSource] = useState("");
  const [farmCode, setFarmCode] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [receiptNoteNo, setReceiptNoteNo] = useState("");
  const [varietyName, setVarietyName] = useState("");
  const [palletsReceived, setPalletsReceived] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;

  const inspectedCount = receiptNoteNo
    ? todaysChecks.filter((c) => c.receiptNoteNo === receiptNoteNo && !c.appliesToWholeDelivery).length
    : 0;
  const palletsReceivedNum = Number(palletsReceived) || 0;

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Shift / Delivery — STR03110</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Shift #">
            <Input name="shiftNumber" value={shiftNumber} onChange={(e) => setShiftNumber(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Raw Material Source (station/line code)">
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
          <FieldGroup label="Variety">
            <Input name="varietyName" value={varietyName} onChange={(e) => setVarietyName(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Number of Pallets Received">
            <Input
              name="numberOfBoxesReceived"
              type="number"
              min="0"
              value={palletsReceived}
              onChange={(e) => setPalletsReceived(e.target.value)}
            />
          </FieldGroup>
        </div>
        {palletsReceivedNum > 0 && (
          <p className="text-xs text-slate-500">
            One crate is sampled per pallet — this delivery needs{" "}
            <Badge color={inspectedCount >= palletsReceivedNum ? "green" : "amber"}>
              {inspectedCount} of {palletsReceivedNum} crates inspected
            </Badge>
          </p>
        )}
      </Card>

      {/* Remounts (resetting to defaults) whenever a new save succeeds. */}
      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log sample"}
      </Button>
    </form>
  );
}

function SampleFields() {
  const [wholeDelivery, setWholeDelivery] = useState(false);
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");

  return (
    <>
      <Card className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            name="appliesToWholeDelivery"
            checked={wholeDelivery}
            onChange={(e) => setWholeDelivery(e.target.checked)}
          />
          Reject the entire delivery (skip pallet-by-pallet detail below)
        </label>
      </Card>

      {!wholeDelivery && (
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
              <FieldGroup label="Temperature (limit 10°C)">
                <Input name="productTemperatureC" type="number" step="0.1" />
              </FieldGroup>
              <FieldGroup label="PH (limit 3.3±0.2)">
                <Input name="acidityPh" type="number" step="0.01" />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Physical Measurements</h2>
            <div className="grid grid-cols-4 gap-3">
              <FieldGroup label="Crate Weight (limit 3.3-3.7kg)">
                <Input name="crateWeightKg" type="number" step="0.1" />
              </FieldGroup>
              <FieldGroup label="Fruit Size Caliber (limit 25-40mm, or per customer spec)">
                <Input name="sizeCaliber" placeholder="25-40mm" />
              </FieldGroup>
              <FieldGroup label="Brix (per customer spec)">
                <Input name="brix" type="number" step="0.1" required />
              </FieldGroup>
              <FieldGroup label="Fruit Color (limit 90% of body)">
                <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
              </FieldGroup>
              <FieldGroup label="Internal Quality Colour (limit 3%)">
                <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" />
              </FieldGroup>
              <FieldGroup label="Foreign Odor (limit NIL)">
                <Input name="foreignOdor" placeholder="NIL" />
              </FieldGroup>
              <FieldGroup label="Foreign Taste (limit NIL)">
                <Input name="foreignTaste" placeholder="NIL" />
              </FieldGroup>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Defects</h2>
            <div className="grid grid-cols-4 gap-3">
              <Pct name="incompleteMaturityPct" label="Incomplete Maturity" limit="1%" />
              <Pct name="moldSignsPct" label="Signs of Mold" limit="1%" />
              <Pct name="mouldPct" label="Mold" limit="0%" />
              <Pct name="capsuleRemainsPct" label="Capsule Remains" limit="2%" />
              <Pct name="birdFoodPct" label="Bird Food" limit="2%" />
              <Pct name="overmaturePct" label="Overmature (soft texture)" limit="5%" />
              <Pct name="skinDamagePct" label="Skin Deformities" limit="2%" />
              <Pct name="shapeDeformitiesPct" label="Shape Deformities" limit="3%" />
              <Pct name="seedClusteringPct" label="Seed Clustering" limit="1%" />
              <Pct name="bruisesPct" label="Bruises" limit="1%" />
              <Pct name="dryCavitiesPct" label="Dry Cavities" limit="1%" />
              <Pct name="overDecappingPct" label="Over De-capping" limit="1%" />
              <Pct name="oxidationPct" label="Oxidation" limit="4%" />
              <Pct name="sandDustPct" label="Sand/Dust" limit="1%" />
              <Pct name="insectsLarvaePct" label="Insects or Larvae" limit="0%" />
              <Pct name="foreignBodiesPct" label="Foreign Bodies" limit="0%" />
              <FieldGroup label="Leaf/Stem Remains (limit 1 piece/1kg)">
                <Input name="leafStemRemainsCount" type="number" step="0.1" min="0" />
              </FieldGroup>
              <Pct name="brokenUncleanPalletsPct" label="Broken/Unclean Pallets" limit="0%" />
              <Pct name="unfumigatedPalletsPct" label="Unfumigated Pallets" limit="0%" />
              <Pct name="brokenUncleanCratesPct" label="Broken/Unclean Crates" limit="0%" />
            </div>
            <p className="text-xs text-slate-400">Total defects (limit 5%) is calculated automatically from the values above.</p>
          </Card>
        </>
      )}

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Decision — Acceptable / Unacceptable">
            <Select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
              <option value="ACCEPTED">Acceptable</option>
              <option value="REJECTED">Unacceptable</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? "Corrective Action" : "Corrective Action (optional)"}>
            <Input name="notes" required={decision === "REJECTED" && wholeDelivery} />
          </FieldGroup>
        </div>
      </Card>
    </>
  );
}
