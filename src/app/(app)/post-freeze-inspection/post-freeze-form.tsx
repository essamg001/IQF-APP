"use client";

import { useActionState, useMemo, useState } from "react";
import { createPostFreezeCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { POST_PACKAGING_DEFECT_FIELDS } from "@/lib/defectFields";
import { FORMAT_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import type { ProductionLot, Field, Pallet, ShiftLog, Grade, Format } from "@prisma/client";

type LotWithRelations = ProductionLot & { field: Field; pallets: Pallet[]; shift: ShiftLog };

type DisplayLimits = {
  fruitColor: string;
  overmature: string;
  incompleteMaturity: string;
  shapeDeformities: string;
  skinDeformities: string;
  cohesiveClusters: string;
  crushedBroken: string;
  crushedBrokenLabel: string;
  dryBruises: string;
  mechanicalFactors: string;
  oxidation: string;
  totalDefects: string;
  calibratedSmall?: string;
};

// STR03111 (Grade A) vs STR03116 (Grade B) — same items, different tolerances.
// Whole fruit only -- Sliced/Diced use one fixed spec regardless of grade.
const WHOLE_LIMITS: Record<Grade, DisplayLimits> = {
  A: {
    fruitColor: "90% of body",
    overmature: "3%",
    incompleteMaturity: "3%",
    shapeDeformities: "3%",
    skinDeformities: "2%",
    cohesiveClusters: "2%",
    crushedBroken: "2%",
    crushedBrokenLabel: "Crushed/Broken Fruit",
    dryBruises: "1%",
    mechanicalFactors: "2%",
    oxidation: "4%",
    totalDefects: "<5%",
    calibratedSmall: "15-25mm",
  },
  B: {
    fruitColor: "80% of body",
    overmature: "5%",
    incompleteMaturity: "5%",
    shapeDeformities: "5%",
    skinDeformities: "3%",
    cohesiveClusters: "3%",
    crushedBroken: "3%",
    crushedBrokenLabel: "Crushed/Broken Fruit",
    dryBruises: "2%",
    mechanicalFactors: "2%",
    oxidation: "6%",
    totalDefects: "10%",
    calibratedSmall: "15-25mm (Class II)",
  },
};

// STR03118 (Sliced) — same numbers as STR03119 (Diced) apart from what the
// "broken" item is actually called; kept as two constants to mirror the two
// separate paper forms.
const SLICED_LIMITS: DisplayLimits = {
  fruitColor: "90% of body",
  overmature: "2%",
  incompleteMaturity: "2%",
  shapeDeformities: "3%",
  skinDeformities: "2%",
  cohesiveClusters: "5%",
  crushedBroken: "20%",
  crushedBrokenLabel: "Broken/Crushed Slices",
  dryBruises: "1%",
  mechanicalFactors: "2%",
  oxidation: "2%",
  totalDefects: "10%",
};

const DICED_LIMITS: DisplayLimits = { ...SLICED_LIMITS, crushedBrokenLabel: "Irregular/Broken Cubes" };

function displayLimitsFor(format: Format, grade: Grade): DisplayLimits {
  if (format === "SLICED") return SLICED_LIMITS;
  if (format === "DICED") return DICED_LIMITS;
  return WHOLE_LIMITS[grade];
}

const FORM_LABEL: Record<Format, (grade: Grade) => string> = {
  WHOLE: (grade) =>
    grade === "A" ? "Final Product (Frozen) — Grade A — STR03111" : "Final Product (Frozen) — Grade B — STR03116",
  SLICED: () => "Final Product (Frozen) — Sliced — STR03118",
  DICED: () => "Final Product (Frozen) — Diced — STR03119",
};

export function PostFreezeInspectionForm({ lots }: { lots: LotWithRelations[] }) {
  const [state, formAction, pending] = useActionState(createPostFreezeCheckAction, undefined);
  const [lotNumber, setLotNumber] = useState("");

  const selectedLot = lots.find((l) => l.lotNumber.toLowerCase() === lotNumber.trim().toLowerCase());
  const pallets = selectedLot?.pallets ?? [];
  const grade = selectedLot?.grade ?? "A";
  const lotFormat = selectedLot?.format ?? "WHOLE";

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">No production lots yet — nothing to inspect.</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{FORM_LABEL[lotFormat](grade)}</h2>
        <div className="grid grid-cols-3 gap-3">
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
            {lotNumber.trim() &&
              (selectedLot ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  ✓ {selectedLot.field.name} — Grade {selectedLot.grade} · {FORMAT_LABEL[selectedLot.format]} — produced{" "}
                  {format(selectedLot.shift.date, "d MMM yyyy")}
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-red-600">No matching lot found — check the number.</p>
              ))}
          </FieldGroup>
          <FieldGroup label="Pallet number">
            <PalletInput key={isSuccess ? state : `${lotNumber}-initial`} pallets={pallets} />
          </FieldGroup>
          <FieldGroup label="Client">
            <Input name="clientName" />
          </FieldGroup>
          <FieldGroup label="Variety">
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label="Shift #">
            <Input name="shiftNumber" />
          </FieldGroup>
          <FieldGroup label="Operation Date">
            <Input name="operationDate" type="date" />
          </FieldGroup>
          <FieldGroup label="Expiry Date">
            <Input name="expiryDate" type="date" />
          </FieldGroup>
          <FieldGroup label="PH (limit 3.3±0.2)">
            <Input name="acidityPh" type="number" step="0.01" />
          </FieldGroup>
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
        </div>
      </Card>

      <MeasurementFields key={isSuccess ? state : "initial"} grade={grade} format={lotFormat} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Saved — logged.</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Log check"}
      </Button>
    </form>
  );
}

function PalletInput({ pallets }: { pallets: Pallet[] }) {
  return (
    <>
      <Input name="palletNumber" list="pallet-suggestions" required placeholder="e.g. M41126146-1-P1" />
      <datalist id="pallet-suggestions">
        {pallets.map((p) => (
          <option key={p.id} value={p.palletNumber} />
        ))}
      </datalist>
    </>
  );
}

function MeasurementFields({ grade, format: lotFormat }: { grade: Grade; format: Format }) {
  const limits = useMemo(() => displayLimitsFor(lotFormat, grade), [lotFormat, grade]);
  const [decision, setDecision] = useState<"ACCEPTED" | "REJECTED">("ACCEPTED");
  const { total: defectTotal, bind } = useDefectTotal(POST_PACKAGING_DEFECT_FIELDS);
  const totalDefectsMax = limitsFor("POST_PACKAGING", grade, lotFormat).find((r) => r.field === "totalDefectsPct")!.max!;

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Sample & Packaging</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Sample Collection Time">
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label="Sample Weight (limit 2kg)">
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Carton/Package Weight">
            <Input name="cartonWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label="Product Temperature (limit -18°C)">
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          {lotFormat === "WHOLE" && (
            <>
              <FieldGroup label="Fruit Diameter — Uncalibrated (25-40mm or per client spec)">
                <Input name="fruitDiameterUncalibrated" placeholder="25-40mm" />
              </FieldGroup>
              <FieldGroup label={`Fruit Diameter — Calibrated, small (${limits.calibratedSmall})`}>
                <Input name="fruitDiameterCalibratedSmall" />
              </FieldGroup>
              <FieldGroup label="Fruit Diameter — Calibrated, medium (25-35mm)">
                <Input name="fruitDiameterCalibratedMedium" />
              </FieldGroup>
              <FieldGroup label="Fruit Diameter — Calibrated, large (>35mm)">
                <Input name="fruitDiameterCalibratedLarge" />
              </FieldGroup>
            </>
          )}
          {lotFormat === "SLICED" && (
            <>
              <FieldGroup label="Slice Thickness — 6-8mm">
                <Input name="sliceThicknessNarrow" />
              </FieldGroup>
              <FieldGroup label="Slice Thickness — 8-10mm">
                <Input name="sliceThicknessWide" />
              </FieldGroup>
            </>
          )}
          {lotFormat === "DICED" && (
            <>
              <FieldGroup label="Cube Size — 10×10×10mm">
                <Input name="cubeSizeSmall" />
              </FieldGroup>
              <FieldGroup label="Cube Size — 20×20×20mm">
                <Input name="cubeSizeLarge" />
              </FieldGroup>
            </>
          )}
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="packageClosureOk" /> Package closure OK (tightly sealed)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="dataLabelReviewOk" /> Data label review OK
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fullPallet" /> Full pallet
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Fruit Quality</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Brix (from raw material check, limit 8±1%)">
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <FieldGroup label={`Fruit Color (limit ${limits.fruitColor})`}>
            <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label="Internal Quality (limit 3%)">
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
          <Pct name="overmaturePct" label="Overmature" limit={limits.overmature} {...bind("overmaturePct")} />
          <Pct name="incompleteMaturityPct" label="Incomplete Maturity" limit={limits.incompleteMaturity} {...bind("incompleteMaturityPct")} />
          <FieldGroup label="Capsule Remains (limit 10 pieces/10kg)">
            <Input name="capsuleRemainsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <FieldGroup label="Leaf Remains (limit 10 pieces/10kg)">
            <Input name="leafRemainsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <FieldGroup label="Stem Fragments (limit 1 piece/10kg)">
            <Input name="stemFragmentsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <Pct name="shapeDeformitiesPct" label="Shape Deformities" limit={limits.shapeDeformities} {...bind("shapeDeformitiesPct")} />
          <Pct name="skinDamagePct" label="Skin Deformities" limit={limits.skinDeformities} {...bind("skinDamagePct")} />
          <Pct name="cohesiveClustersPct" label="Cohesive Clusters (2-3 pcs)" limit={limits.cohesiveClusters} {...bind("cohesiveClustersPct")} />
          <Pct name="crushedBrokenFruitPct" label={limits.crushedBrokenLabel} limit={limits.crushedBroken} {...bind("crushedBrokenFruitPct")} />
          <Pct name="dryBruisesPct" label="Dry Bruises" limit={limits.dryBruises} {...bind("dryBruisesPct")} />
          <Pct name="mechanicalFactorsPct" label="Mechanical Factors" limit={limits.mechanicalFactors} {...bind("mechanicalFactorsPct")} />
          <Pct name="oxidationPct" label="Oxidation" limit={limits.oxidation} {...bind("oxidationPct")} />
          <Pct name="fungalInfectionPct" label="Fungal Infection" limit="0%" {...bind("fungalInfectionPct")} />
          <Pct name="insectsLarvaePct" label="Insects/Larvae" limit="0%" {...bind("insectsLarvaePct")} />
          <Pct name="insectInfestationPct" label="Insect Infestation" limit="0%" {...bind("insectInfestationPct")} />
          <Pct name="foreignBodiesPct" label="Foreign Bodies" limit="0%" {...bind("foreignBodiesPct")} />
          <FieldGroup label="Frozen Product Waiting Period (limit 10-30 min)">
            <Input name="frozenProductWaitMinutes" type="number" step="1" />
          </FieldGroup>
        </div>
        <p className={cn("text-xs font-medium", defectTotal > totalDefectsMax ? "text-red-600" : "text-slate-400")}>
          Running total: {defectTotal.toFixed(1)}% (limit {limits.totalDefects})
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Decision — Acceptable / Unacceptable">
            <Select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
              <option value="ACCEPTED">Acceptable</option>
              <option value="REJECTED">Unacceptable</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? "Corrective Action" : "Corrective Action (optional)"}>
            <Input name="notes" required={decision === "REJECTED"} />
          </FieldGroup>
        </div>
      </Card>
    </>
  );
}

function Pct({
  name,
  label,
  limit,
  value,
  onChange,
}: {
  name: string;
  label: string;
  limit: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <FieldGroup label={`${label} (limit ${limit})`}>
      <Input name={name} type="number" step="0.1" min="0" max="100" value={value} onChange={onChange} />
    </FieldGroup>
  );
}
