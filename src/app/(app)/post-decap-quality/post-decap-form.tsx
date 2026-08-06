"use client";

import { useActionState, useState } from "react";
import { createPostDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { DECAP_SHARED_DEFECT_FIELDS } from "@/lib/defectFields";
import { cn } from "@/lib/cn";

// The factory has 51 QC staff, each identified on paperwork as "QC1"..."QC51".
const QC_NUMBERS = Array.from({ length: 51 }, (_, i) => `QC${i + 1}`);

const TOTAL_DEFECTS_LIMIT = limitsFor("POST_DECAP").find((r) => r.field === "totalDefectsPct")!.max!;

function Pct({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <FieldGroup label={label}>
      <Input name={name} type="number" step="0.1" min="0" max="100" value={value} onChange={onChange} />
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
          <FieldGroup label="Harvest Ticket Serial Number">
            <Input
              name="receiptNoteNo"
              value={receiptNoteNo}
              onChange={(e) => setReceiptNoteNo(e.target.value)}
              placeholder="Same as the pre-decap arrival"
            />
          </FieldGroup>
          <FieldGroup label="Field / Plot (auto-filled from Serial Number, editable)">
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
  const { total: defectTotal, bind } = useDefectTotal(DECAP_SHARED_DEFECT_FIELDS);

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
          <Pct name="incompleteMaturityPct" label="Incomplete Maturity (limit ≤1%)" {...bind("incompleteMaturityPct")} />
          <Pct name="moldSignsPct" label="Mold Signs (limit ≤1%)" {...bind("moldSignsPct")} />
          <Pct name="mouldPct" label="Mould (limit 0%)" {...bind("mouldPct")} />
          <Pct name="capsuleRemainsPct" label="Capsule Remains (limit ≤2%)" {...bind("capsuleRemainsPct")} />
          <Pct name="birdFoodPct" label="Bird-Eaten (limit ≤2%)" {...bind("birdFoodPct")} />
          <Pct name="overmaturePct" label="Over Maturity (limit ≤5%)" {...bind("overmaturePct")} />
          <Pct name="skinDamagePct" label="Shell Deformities (limit ≤2%)" {...bind("skinDamagePct")} />
          <Pct name="shapeDeformitiesPct" label="Shape Deformities (limit ≤3%)" {...bind("shapeDeformitiesPct")} />
          <Pct name="seedClusteringPct" label="Seed Clustering (limit ≤1%)" {...bind("seedClusteringPct")} />
          <Pct name="bruisesPct" label="Bruises (limit ≤1%)" {...bind("bruisesPct")} />
          <Pct name="dryCavitiesPct" label="Dry Cavities (limit ≤1%)" {...bind("dryCavitiesPct")} />
          <Pct name="overDecappingPct" label="Over-Decapping (limit ≤1%)" {...bind("overDecappingPct")} />
          <Pct name="oxidationPct" label="Oxidation (limit ≤4%)" {...bind("oxidationPct")} />
          <Pct name="sandDustPct" label="Sand / Light Soil (limit ≤1%)" {...bind("sandDustPct")} />
          <Pct name="insectsLarvaePct" label="Insects / Larvae (limit 0%)" {...bind("insectsLarvaePct")} />
          <Pct name="foreignBodiesPct" label="Foreign Bodies (limit 0%)" {...bind("foreignBodiesPct")} />
          <FieldGroup label="Leaf/Stem Remains (limit 1 pc/1kg)">
            <Input name="leafStemRemainsCount" type="number" step="1" min="0" />
          </FieldGroup>
          <Pct name="brokenUncleanPalletsPct" label="Broken/Unclean Pallets (limit 0%)" {...bind("brokenUncleanPalletsPct")} />
          <Pct name="unfumigatedPalletsPct" label="Unfumigated Pallets (limit 0%)" {...bind("unfumigatedPalletsPct")} />
          <Pct name="brokenUncleanCratesPct" label="Broken/Unclean Trays (limit 0%)" {...bind("brokenUncleanCratesPct")} />
        </div>
        <p className={cn("text-xs font-medium", defectTotal > TOTAL_DEFECTS_LIMIT ? "text-red-600" : "text-slate-400")}>
          Running total: {defectTotal.toFixed(1)}% (limit ≤{TOTAL_DEFECTS_LIMIT}%)
        </p>
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
