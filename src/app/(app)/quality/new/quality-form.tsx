"use client";

import { useActionState, useMemo, useState } from "react";
import { createQualityCheckAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProductionLot, Field, Pallet } from "@prisma/client";

type LotWithRelations = ProductionLot & { field: Field; pallets: Pallet[] };

export function QualityCheckForm({ lots }: { lots: LotWithRelations[] }) {
  const [error, formAction, pending] = useActionState(createQualityCheckAction, undefined);
  const [lotNumber, setLotNumber] = useState("");
  const [checkpoint, setCheckpoint] = useState<"RAW_MATERIAL" | "POST_PACKAGING">("RAW_MATERIAL");

  const pallets = useMemo(
    () => lots.find((l) => l.lotNumber.toLowerCase() === lotNumber.trim().toLowerCase())?.pallets ?? [],
    [lots, lotNumber]
  );

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Lot number">
            <Input
              name="lotNumber"
              required
              list="lot-suggestions"
              placeholder="e.g. M41126146-1"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
            />
            <datalist id="lot-suggestions">
              {lots.map((l) => (
                <option key={l.id} value={l.lotNumber} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label="Checkpoint">
            <Select
              name="checkpoint"
              required
              value={checkpoint}
              onChange={(e) => setCheckpoint(e.target.value as typeof checkpoint)}
            >
              <option value="RAW_MATERIAL">Raw Material Intake (STR03110)</option>
              <option value="POST_PACKAGING">Post-Packaging / Final Product (Frozen) (STR03111 / STR03116)</option>
            </Select>
          </FieldGroup>
        </div>

        {checkpoint === "POST_PACKAGING" && (
          <FieldGroup label="Pallet number (optional — leave blank for a lot-level check)">
            <Input name="palletNumber" list="pallet-suggestions" placeholder="e.g. M41126146-1-P1" />
            <datalist id="pallet-suggestions">
              {pallets.map((p) => (
                <option key={p.id} value={p.palletNumber} />
              ))}
            </datalist>
          </FieldGroup>
        )}

        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Compliance level">
            <Select name="complianceLevel" defaultValue="">
              <option value="">—</option>
              <option value="GLOBALGAP">GLOBALG.A.P</option>
              <option value="SPRING">Spring</option>
              <option value="LEAF">LEAF</option>
              <option value="OTHER">Other</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="Compliance (if Other)">
            <Input name="complianceOther" />
          </FieldGroup>
          <FieldGroup label="Shift #">
            <Input name="shiftNumber" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Shared measurements</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Brix">
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <FieldGroup label="Acidity pH">
            <Input name="acidityPh" type="number" step="0.01" placeholder="3.3 ± 0.2" />
          </FieldGroup>
          <FieldGroup label="Product Temperature (°C)">
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          <FieldGroup label="Variety Name">
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label="Sample Collection Time">
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Sample Weight (kg)">
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Fruit Color (% of surface)">
            <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
          </FieldGroup>
          <FieldGroup label="Internal Quality (%)">
            <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
          </FieldGroup>
          <FieldGroup label="Mould (%)">
            <Input name="mouldPct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
          </FieldGroup>
          <FieldGroup label="Skin Damage (%)">
            <Input name="skinDamagePct" type="number" step="0.1" min="0" max="100" defaultValue={0} />
          </FieldGroup>
          <FieldGroup label="Firmness score">
            <Input name="firmnessScore" type="number" step="0.1" />
          </FieldGroup>
        </div>
      </Card>

      {checkpoint === "RAW_MATERIAL" && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Raw Material Intake (STR03110)</h2>
          <div className="grid grid-cols-4 gap-3">
            <FieldGroup label="Sample No.">
              <Input name="sampleNo" />
            </FieldGroup>
            <FieldGroup label="Raw Material Source (Station/Batch Code)">
              <Input name="rawMaterialSource" />
            </FieldGroup>
            <FieldGroup label="Farm Code">
              <Input name="farmCode" />
            </FieldGroup>
            <FieldGroup label="Transport Vehicle No.">
              <Input name="transportVehicleNo" />
            </FieldGroup>
            <FieldGroup label="Receipt Note No.">
              <Input name="receiptNoteNo" />
            </FieldGroup>
            <FieldGroup label="Number of Boxes Received">
              <Input name="numberOfBoxesReceived" type="number" />
            </FieldGroup>
            <FieldGroup label="Crate Weight (kg)">
              <Input name="crateWeightKg" type="number" step="0.1" placeholder="3.3 - 3.7" />
            </FieldGroup>
            <FieldGroup label="Fruit Size Caliber">
              <Input name="sizeCaliber" placeholder="25-40mm" />
            </FieldGroup>
          </div>
        </Card>
      )}

      {checkpoint === "POST_PACKAGING" && (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Post-Packaging / Final Product (Frozen) (STR03111 / STR03116)</h2>
          <div className="grid grid-cols-4 gap-3">
            <FieldGroup label="Client">
              <Input name="clientName" />
            </FieldGroup>
            <FieldGroup label="Operation Date">
              <Input name="operationDate" type="date" />
            </FieldGroup>
            <FieldGroup label="Expiry Date">
              <Input name="expiryDate" type="date" />
            </FieldGroup>
            <FieldGroup label="Carton Weight (kg)">
              <Input name="cartonWeightKg" type="number" step="0.01" />
            </FieldGroup>
            <FieldGroup label="Fruit Diameter — Uncalibrated">
              <Input name="fruitDiameterUncalibrated" placeholder="25-40mm" />
            </FieldGroup>
            <FieldGroup label="Fruit Diameter — Calibrated (regular)">
              <Input name="fruitDiameterCalibratedRegular" placeholder="25-35mm" />
            </FieldGroup>
            <FieldGroup label="Fruit Diameter — Calibrated (irregular)">
              <Input name="fruitDiameterCalibratedIrregular" placeholder=">35mm" />
            </FieldGroup>
            <FieldGroup label="Fruit Diameter — Calibrated (small / Class II)">
              <Input name="fruitDiameterCalibratedSmall" placeholder="15-25mm" />
            </FieldGroup>
            <FieldGroup label="Foreign Odor">
              <Input name="foreignOdor" placeholder="NIL" />
            </FieldGroup>
            <FieldGroup label="Foreign Taste">
              <Input name="foreignTaste" placeholder="NIL" />
            </FieldGroup>
            <FieldGroup label="Overmature / Soft Texture (%)">
              <Input name="overmaturePct" type="number" step="0.1" />
            </FieldGroup>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="fullPallet" /> Full pallet
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="packageClosureOk" /> Package closure OK (tightly sealed)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="dataLabelReviewOk" /> Data label review OK
            </label>
          </div>
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}
