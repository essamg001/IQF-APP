"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createPreDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult } from "@/lib/qualityLimits";

function Pct({ name, label }: { name: string; label: string }) {
  return (
    <FieldGroup label={label}>
      <Input name={name} type="number" step="0.1" min="0" max="100" />
    </FieldGroup>
  );
}

type FieldOption = { id: string; name: string };

export function PreDecapForm({ fields }: { fields: FieldOption[] }) {
  const [state, formAction, pending] = useActionState(createPreDecapCheckAction, undefined);

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  return (
    <form action={formAction} className="space-y-4">
      <SampleFields key={isSuccess ? state : "initial"} fields={fields} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}

function PlotInput({ fields }: { fields: FieldOption[] }) {
  return (
    <>
      <Input name="fieldName" required list="plot-suggestions" placeholder="e.g. MAFA 4 · ST1 · A1" />
      <datalist id="plot-suggestions">
        {fields.map((f) => (
          <option key={f.id} value={f.name} />
        ))}
      </datalist>
    </>
  );
}

function SampleFields({ fields }: { fields: FieldOption[] }) {
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery Identity</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Serial Number (Receipt)">
            <Input name="receiptNoteNo" />
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label="Sample No.">
            <Input name="sampleNo" required />
          </FieldGroup>
          <FieldGroup label="Plot Number">
            <PlotInput fields={fields} />
          </FieldGroup>
          <FieldGroup label="Crates Received">
            <Input name="numberOfBoxesReceived" type="number" step="1" min="0" />
          </FieldGroup>
          <FieldGroup label="Time of Sample">
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Sample Weight (kg)">
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Temperature (°C, limit ≥30)">
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="Harvest Supervisor">
            <Input name="harvestSupervisor" placeholder="Who to notify via GEN03108 if defects found" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Physical Measurements</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Av. Brix (limit ≥7%)">
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <Pct name="fruitColorPct" label="Berry Colour (limit ≥85%)" />
          <Pct name="internalQualityPct" label="Internal Quality (limit ≤10%)" />
          <FieldGroup label="Cleaning and Good Crates">
            <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="cleaningGoodCratesOk" defaultChecked className="h-4 w-4 rounded border-slate-300" />
              OK
            </label>
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Defects</h2>
        <div className="grid grid-cols-4 gap-3">
          <Pct name="overmaturePct" label="Over Maturity (limit ≤50%)" />
          <Pct name="diameterUnder22mmPct" label="Diameter < 22mm (limit ≤10%)" />
          <Pct name="botrytisPct" label="Botrytis (limit ≤10%)" />
          <Pct name="pestDiseasePct" label="Pest / Diseases (limit ≤10%)" />
          <Pct name="wormEatenPct" label="Worm-Eaten (limit ≤10%)" />
          <Pct name="bruisesPct" label="Bruises (limit ≤20%)" />
          <Pct name="shapeDeformitiesPct" label="Mishape (limit ≤50%)" />
          <Pct name="sandDustPct" label="Sand (limit ≤15%)" />
          <Pct name="foreignBodiesPct" label="Foreign Bodies (limit 0%)" />
        </div>
        <p className="text-xs text-slate-400">Total defects (limit ≤60%) is calculated automatically from the values above.</p>
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
