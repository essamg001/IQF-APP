"use client";

import { useActionState, useState } from "react";
import { createPostDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult } from "@/lib/qualityLimits";

// The factory has 51 QC staff, each identified on paperwork as "QC1"..."QC51".
const QC_NUMBERS = Array.from({ length: 51 }, (_, i) => `QC${i + 1}`);

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

  const [receiptNoteNo, setReceiptNoteNo] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  const matchedFieldName = fieldByReceiptNote[receiptNoteNo.trim()] ?? "";

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Traceability (not on STR03107, kept for field tracing)</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Receipt Note No.">
            <Input
              name="receiptNoteNo"
              value={receiptNoteNo}
              onChange={(e) => setReceiptNoteNo(e.target.value)}
              placeholder="Same as the pre-decap arrival"
            />
          </FieldGroup>
          <FieldGroup label="Field / Plot (auto-filled from Receipt Note, editable)">
            <FieldNameInput key={matchedFieldName || "manual"} defaultValue={matchedFieldName} fields={fields} />
          </FieldGroup>
        </div>
        {receiptNoteNo && !matchedFieldName && (
          <p className="text-xs text-amber-600">
            No pre-decap arrival found yet for this receipt note — type the field in manually, or leave blank.
          </p>
        )}
      </Card>

      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
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
      <Input name="fieldName" list="field-suggestions" defaultValue={defaultValue} placeholder="e.g. MAFA 4 · ST1 · A1" />
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
        <h2 className="text-sm font-semibold text-slate-900">Delivery Identity</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Variety">
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label="Client">
            <Input name="clientName" />
          </FieldGroup>
          <FieldGroup label="Sample No.">
            <Input name="sampleNo" required />
          </FieldGroup>
          <FieldGroup label="Processing Line">
            <Input name="processingLine" />
          </FieldGroup>
          <FieldGroup label="Time of Sample">
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Physical Measurements</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Plate Weight (kg, limit 3.3–3.7)">
            <Input name="crateWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Fruit Diameter (limit 25-40mm)">
            <Input name="sizeCaliber" placeholder="25-40mm" />
          </FieldGroup>
          <FieldGroup label="Brix (limit >7%)">
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <Pct name="fruitColorPct" label="Fruit Colour (limit ≥90% red)" />
          <Pct name="internalQualityPct" label="Internal Quality (limit ≤3%)" />
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
          <Pct name="incompleteMaturityPct" label="Incomplete Maturity (limit ≤1%)" />
          <Pct name="moldSignsPct" label="Mold Signs (limit ≤1%)" />
          <Pct name="mouldPct" label="Mould (limit 0%)" />
          <Pct name="capsuleRemainsPct" label="Capsule Remains (limit ≤2%)" />
          <Pct name="birdFoodPct" label="Bird-Eaten (limit ≤2%)" />
          <Pct name="overmaturePct" label="Over Maturity (limit ≤5%)" />
          <Pct name="skinDamagePct" label="Shell Deformities (limit ≤2%)" />
          <Pct name="shapeDeformitiesPct" label="Shape Deformities (limit ≤3%)" />
          <Pct name="seedClusteringPct" label="Seed Clustering (limit ≤1%)" />
          <Pct name="bruisesPct" label="Bruises (limit ≤1%)" />
          <Pct name="dryCavitiesPct" label="Dry Cavities (limit ≤1%)" />
          <Pct name="overDecappingPct" label="Over-Decapping (limit ≤1%)" />
          <Pct name="oxidationPct" label="Oxidation (limit ≤4%)" />
          <Pct name="sandDustPct" label="Sand / Light Soil (limit ≤1%)" />
          <Pct name="insectsLarvaePct" label="Insects / Larvae (limit 0%)" />
          <Pct name="foreignBodiesPct" label="Foreign Bodies (limit 0%)" />
          <FieldGroup label="Leaf/Stem Remains (limit 1 pc/1kg)">
            <Input name="leafStemRemainsCount" type="number" step="1" min="0" />
          </FieldGroup>
          <Pct name="brokenUncleanPalletsPct" label="Broken/Unclean Pallets (limit 0%)" />
          <Pct name="unfumigatedPalletsPct" label="Unfumigated Pallets (limit 0%)" />
          <Pct name="brokenUncleanCratesPct" label="Broken/Unclean Trays (limit 0%)" />
        </div>
        <p className="text-xs text-slate-400">Total defects (limit 3-6%) is calculated automatically from the values above.</p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="QC Approver">
            <Select name="decapQcApprover" required defaultValue="">
              <option value="" disabled>
                Select QC…
              </option>
              {QC_NUMBERS.map((qc) => (
                <option key={qc} value={qc}>
                  {qc}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Conforming / Nonconforming to Specs">
            <Select
              name="decision"
              required
              value={decision}
              onChange={(e) => setDecision(e.target.value as typeof decision)}
            >
              <option value="ACCEPTED">Conforming</option>
              <option value="REJECTED">Nonconforming</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? "Corrective Action" : "Corrective Action (optional)"}>
            <Input
              name="notes"
              placeholder={decision === "REJECTED" ? "What corrective action was taken?" : undefined}
              required={decision === "REJECTED"}
            />
          </FieldGroup>
        </div>
        {decision === "REJECTED" && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="Diverted To">
              <Input name="divertedTo" placeholder="e.g. Local market" />
            </FieldGroup>
            <FieldGroup label="Packing Group Re-Training">
              <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="retrainingRequested" className="h-4 w-4 rounded border-slate-300" />
                Requested
              </label>
            </FieldGroup>
          </div>
        )}
      </Card>
    </>
  );
}
