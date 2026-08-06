"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createPreDecapCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { PRE_DECAP_DEFECT_FIELDS } from "@/lib/defectFields";
import { cn } from "@/lib/cn";

const TOTAL_DEFECTS_LIMIT = limitsFor("PRE_DECAP").find((r) => r.field === "totalDefectsPct")!.max!;

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

type PlotLineOption = {
  id: string;
  stationNo: string | null;
  plotValveGhNo: string | null;
  varietyName: string | null;
  field: { id: string; name: string } | null;
};

type HarvestTicketOption = {
  id: string;
  serialNumber: string;
  plotLines: PlotLineOption[];
};

export function PreDecapForm({
  fields,
  harvestTickets,
}: {
  fields: FieldOption[];
  harvestTickets: HarvestTicketOption[];
}) {
  const [state, formAction, pending] = useActionState(createPreDecapCheckAction, undefined);

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  return (
    <form action={formAction} className="space-y-4">
      <SampleFields key={isSuccess ? state : "initial"} fields={fields} harvestTickets={harvestTickets} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}

function plotLineLabel(l: PlotLineOption) {
  const parts = [l.stationNo, l.plotValveGhNo, l.varietyName].filter(Boolean);
  const base = parts.length ? parts.join(" · ") : l.id;
  return l.field ? base : `${base} (unmatched to a Field record)`;
}

function SerialPlotPicker({ tickets, fields }: { tickets: HarvestTicketOption[]; fields: FieldOption[] }) {
  const [serial, setSerial] = useState("");
  const matchedTicket = tickets.find((t) => t.serialNumber.trim().toLowerCase() === serial.trim().toLowerCase());

  return (
    <>
      <FieldGroup label="Harvest Ticket Serial Number">
        <Input
          name="receiptNoteNo"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          list="ticket-serials"
          placeholder="e.g. GEN03107-..."
        />
        <datalist id="ticket-serials">
          {tickets.map((t) => (
            <option key={t.id} value={t.serialNumber} />
          ))}
        </datalist>
      </FieldGroup>

      {matchedTicket ? (
        <FieldGroup label="Plot Sampled">
          <Select name="plotLineId" required defaultValue="">
            <option value="" disabled>
              Select the plot this sample came from
            </option>
            {matchedTicket.plotLines.map((l) => (
              <option key={l.id} value={l.id}>
                {plotLineLabel(l)}
              </option>
            ))}
          </Select>
        </FieldGroup>
      ) : (
        <FieldGroup label="Plot Number">
          <Input name="fieldName" required list="plot-suggestions" placeholder="e.g. MAFA 4 · ST1 · A1" />
          <datalist id="plot-suggestions">
            {fields.map((f) => (
              <option key={f.id} value={f.name} />
            ))}
          </datalist>
        </FieldGroup>
      )}
    </>
  );
}

function SampleFields({ fields, harvestTickets }: { fields: FieldOption[]; harvestTickets: HarvestTicketOption[] }) {
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");
  const { total: defectTotal, bind } = useDefectTotal(PRE_DECAP_DEFECT_FIELDS);

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery Identity</h2>
        <div className="grid grid-cols-4 gap-3">
          <SerialPlotPicker tickets={harvestTickets} fields={fields} />
          <FieldGroup label="Variety">
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label="Sample No.">
            <Input name="sampleNo" required />
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
          <Pct name="overmaturePct" label="Over Maturity (limit ≤50%)" {...bind("overmaturePct")} />
          <Pct name="diameterUnder22mmPct" label="Diameter < 22mm (limit ≤10%)" {...bind("diameterUnder22mmPct")} />
          <Pct name="botrytisPct" label="Botrytis (limit ≤10%)" {...bind("botrytisPct")} />
          <Pct name="pestDiseasePct" label="Pest / Diseases (limit ≤10%)" {...bind("pestDiseasePct")} />
          <Pct name="wormEatenPct" label="Worm-Eaten (limit ≤10%)" {...bind("wormEatenPct")} />
          <Pct name="bruisesPct" label="Bruises (limit ≤20%)" {...bind("bruisesPct")} />
          <Pct name="shapeDeformitiesPct" label="Mishape (limit ≤50%)" {...bind("shapeDeformitiesPct")} />
          <Pct name="sandDustPct" label="Sand (limit ≤15%)" {...bind("sandDustPct")} />
          <Pct name="foreignBodiesPct" label="Foreign Bodies (limit 0%)" {...bind("foreignBodiesPct")} />
        </div>
        <p className={cn("text-xs font-medium", defectTotal > TOTAL_DEFECTS_LIMIT ? "text-red-600" : "text-slate-400")}>
          Running total: {defectTotal.toFixed(1)}% (limit ≤{TOTAL_DEFECTS_LIMIT}%)
        </p>
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
