"use client";

import { useActionState, useState } from "react";
import { createHarvestTicketAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type PlotLine = {
  stationNo?: string;
  plotValveGhNo?: string;
  varietyName?: string;
  cycleNumber?: string;
  plantingYear?: string;
  cutNo?: string;
  palletsCount?: string;
  cratesCount?: string;
  weightKg?: string;
};

const EMPTY_LINE: PlotLine = {};

const COMPLIANCE_LEVELS = [
  ["GLOBALGAP", "GlobalG.A.P."],
  ["SPRING", "Spring"],
  ["LEAF", "Leaf"],
  ["NURTURE", "Nurture"],
  ["AH_DL_GROW", "AH/DL Grow"],
  ["FAIRTRADE", "Fairtrade"],
  ["ORGANIC_100", "100% Organic"],
  ["BIO_SUISSE", "Bio Suisse"],
  ["OTHER", "Other"],
] as const;

function PlotLineCard({
  line,
  onChange,
  onRemove,
}: {
  line: PlotLine;
  onChange: (next: PlotLine) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof PlotLine, value: string) => onChange({ ...line, [key]: value });

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">Plot line</p>
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        <FieldGroup label="Station No.">
          <Input value={line.stationNo ?? ""} onChange={(e) => set("stationNo", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Plot/Valve/GH No.">
          <Input value={line.plotValveGhNo ?? ""} onChange={(e) => set("plotValveGhNo", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Variety">
          <Input value={line.varietyName ?? ""} onChange={(e) => set("varietyName", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Cycle No.">
          <Input value={line.cycleNumber ?? ""} onChange={(e) => set("cycleNumber", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Planting Year">
          <Input value={line.plantingYear ?? ""} onChange={(e) => set("plantingYear", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Cut No.">
          <Input value={line.cutNo ?? ""} onChange={(e) => set("cutNo", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Pallets">
          <Input type="number" step="1" value={line.palletsCount ?? ""} onChange={(e) => set("palletsCount", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Crates">
          <Input type="number" step="1" value={line.cratesCount ?? ""} onChange={(e) => set("cratesCount", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Weight (kg)">
          <Input type="number" step="0.1" value={line.weightKg ?? ""} onChange={(e) => set("weightKg", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

export function TicketForm() {
  const [error, formAction, pending] = useActionState(createHarvestTicketAction, undefined);
  const [lines, setLines] = useState<PlotLine[]>([{ ...EMPTY_LINE }]);
  const [productType, setProductType] = useState("");

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery Identity (GEN03107)</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Harvest Ticket Serial Number">
            <Input name="serialNumber" required />
          </FieldGroup>
          <FieldGroup label="GGN">
            <Input name="ggn" />
          </FieldGroup>
          <FieldGroup label="Compliance Level">
            <Select name="complianceLevel" defaultValue="">
              <option value="">—</option>
              {COMPLIANCE_LEVELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Compliance (if Other)">
            <Input name="complianceOther" />
          </FieldGroup>
          <FieldGroup label="Product Type">
            <Select name="productType" value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="">—</option>
              <option value="RAW">Raw</option>
              <option value="FINAL">Final</option>
              <option value="REWORK">Rework</option>
            </Select>
          </FieldGroup>
          {productType === "REWORK" && (
            <FieldGroup label="Rework Reason">
              <Input name="reworkReason" />
            </FieldGroup>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Conformity Checklist</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fruitConformityOk" /> Fruit conformity OK
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fruitSafetyOk" /> Fruit safety OK
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="cratesCleanlinessOk" /> Crates cleanliness OK
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fieldCleanlinessOk" /> Field cleanliness OK
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="vehicleCleanlinessOk" /> Vehicle cleanliness OK
          </label>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Presence Checklist</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="petsPresent" /> Pets present
            </label>
            <Input name="petsPresentAction" placeholder="Corrective action (if flagged)" />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="animalProductionNearby" /> Animal production nearby
            </label>
            <Input name="animalProductionNearbyAction" placeholder="Corrective action (if flagged)" />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="wildDomesticAnimalActivity" /> Wild/domestic animal activity
            </label>
            <Input name="wildDomesticAnimalActivityAction" placeholder="Corrective action (if flagged)" />
          </div>
          <div className="grid grid-cols-2 items-start gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="rodentDogActivity" /> Rodent/dog activity
            </label>
            <Input name="rodentDogActivityAction" placeholder="Corrective action (if flagged)" />
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Delivery & Harvest Details</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Loading Supervisor">
            <Input name="loadingSupervisor" />
          </FieldGroup>
          <FieldGroup label="Loading Time">
            <Input name="loadingTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Transferred By">
            <Input name="transferredBy" />
          </FieldGroup>
          <FieldGroup label="Vehicle No.">
            <Input name="vehicleNo" />
          </FieldGroup>
          <FieldGroup label="Authorized Grower">
            <Input name="authorizedGrower" />
          </FieldGroup>
          <FieldGroup label="Crop Name">
            <Input name="cropName" />
          </FieldGroup>
          <FieldGroup label="Harvest Time">
            <Input name="harvestTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Harvest Supervisor">
            <Input name="harvestSupervisor" />
          </FieldGroup>
          <FieldGroup label="Harvest Date">
            <Input name="harvestDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Plots Supplying This Delivery</h2>
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            Add plot
          </Button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <PlotLineCard
              key={i}
              line={line}
              onChange={(next) => setLines(lines.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
            />
          ))}
          {lines.length === 0 && <p className="text-sm text-slate-400">No plots added yet.</p>}
        </div>
      </Card>

      <input type="hidden" name="plotLinesJson" value={JSON.stringify(lines)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Harvest Ticket"}
      </Button>
    </form>
  );
}
