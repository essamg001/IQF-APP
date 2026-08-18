"use client";

import { useActionState, useMemo, useState } from "react";
import { createPostFreezeCheckAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QualityLimitWarning } from "@/components/ui/quality-limit-warning";
import { VarietyField } from "@/components/variety-field";
import { decodeActionResult, limitsFor } from "@/lib/qualityLimits";
import { useDefectTotal } from "@/lib/useDefectTotal";
import { POST_PACKAGING_DEFECT_FIELDS } from "@/lib/defectFields";
import { FORMAT_LABEL } from "@/lib/format";
import { addYears, parseLocalDateOnly, toDateOnlyString } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { format } from "date-fns";
import type { ProductionLot, Field, Pallet, ShiftLog, Grade, Format } from "@prisma/client";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/getDictionary";

type LotWithRelations = ProductionLot & { field: Field; pallets: Pallet[]; shift: ShiftLog };

type CrushedBrokenKey = "crushedBrokenFruit" | "crushedBrokenSlices" | "irregularBrokenCubes";

type DisplayLimits = {
  fruitColorPct: string;
  overmature: string;
  incompleteMaturity: string;
  shapeDeformities: string;
  skinDeformities: string;
  cohesiveClusters: string;
  crushedBroken: string;
  crushedBrokenLabelKey: CrushedBrokenKey;
  dryBruises: string;
  mechanicalFactors: string;
  oxidation: string;
  totalDefects: string;
  calibratedSmall?: string;
  calibratedSmallIsClassII?: boolean;
};

// STR03111 (Grade A) vs STR03116 (Grade B) — same items, different tolerances.
// Whole fruit only -- Sliced/Diced use one fixed spec regardless of grade.
const WHOLE_LIMITS: Record<Grade, DisplayLimits> = {
  A: {
    fruitColorPct: "90%",
    overmature: "3%",
    incompleteMaturity: "3%",
    shapeDeformities: "3%",
    skinDeformities: "2%",
    cohesiveClusters: "2%",
    crushedBroken: "2%",
    crushedBrokenLabelKey: "crushedBrokenFruit",
    dryBruises: "1%",
    mechanicalFactors: "2%",
    oxidation: "4%",
    totalDefects: "<5%",
    calibratedSmall: "15-25mm",
  },
  B: {
    fruitColorPct: "80%",
    overmature: "5%",
    incompleteMaturity: "5%",
    shapeDeformities: "5%",
    skinDeformities: "3%",
    cohesiveClusters: "3%",
    crushedBroken: "3%",
    crushedBrokenLabelKey: "crushedBrokenFruit",
    dryBruises: "2%",
    mechanicalFactors: "2%",
    oxidation: "6%",
    totalDefects: "10%",
    calibratedSmall: "15-25mm",
    calibratedSmallIsClassII: true,
  },
};

// STR03118 (Sliced) — same numbers as STR03119 (Diced) apart from what the
// "broken" item is actually called; kept as two constants to mirror the two
// separate paper forms.
const SLICED_LIMITS: DisplayLimits = {
  fruitColorPct: "90%",
  overmature: "2%",
  incompleteMaturity: "2%",
  shapeDeformities: "3%",
  skinDeformities: "2%",
  cohesiveClusters: "5%",
  crushedBroken: "20%",
  crushedBrokenLabelKey: "crushedBrokenSlices",
  dryBruises: "1%",
  mechanicalFactors: "2%",
  oxidation: "2%",
  totalDefects: "10%",
};

const DICED_LIMITS: DisplayLimits = { ...SLICED_LIMITS, crushedBrokenLabelKey: "irregularBrokenCubes" };

function displayLimitsFor(format: Format, grade: Grade): DisplayLimits {
  if (format === "SLICED") return SLICED_LIMITS;
  if (format === "DICED") return DICED_LIMITS;
  return WHOLE_LIMITS[grade];
}

function formLabelFor(dict: Dictionary["postFreezeInspection"], lotFormat: Format, grade: Grade): string {
  if (lotFormat === "SLICED") return dict.formLabelSliced;
  if (lotFormat === "DICED") return dict.formLabelDiced;
  return grade === "A" ? dict.formLabelWholeA : dict.formLabelWholeB;
}

export function PostFreezeInspectionForm({ lots }: { lots: LotWithRelations[] }) {
  const [state, formAction, pending] = useActionState(createPostFreezeCheckAction, undefined);
  const [lotNumber, setLotNumber] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  const selectedLot = lots.find((l) => l.lotNumber.toLowerCase() === lotNumber.trim().toLowerCase());
  const pallets = selectedLot?.pallets ?? [];
  const grade = selectedLot?.grade ?? "A";
  const lotFormat = selectedLot?.format ?? "WHOLE";

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;
  const fullDict = useTranslations();
  const dict = fullDict.postFreezeInspection;

  if (lots.length === 0) {
    return <p className="text-sm text-slate-500">{dict.noLotsYet}</p>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{formLabelFor(dict, lotFormat, grade)}</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.lotNumber}>
            <Input
              name="lotNumber"
              required
              list="lot-suggestions"
              placeholder={dict.lotNumberPlaceholder}
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
                  {dict.matchedLot
                    .replace("{field}", selectedLot.field.name)
                    .replace("{grade}", selectedLot.grade)
                    .replace("{format}", FORMAT_LABEL[selectedLot.format])
                    .replace("{date}", format(selectedLot.shift.date, "d MMM yyyy"))}
                </p>
              ) : (
                <p className="mt-1 text-xs font-medium text-red-600">{dict.noMatchingLot}</p>
              ))}
          </FieldGroup>
          <FieldGroup label={dict.palletNumber}>
            <PalletInput key={isSuccess ? state : `${lotNumber}-initial`} pallets={pallets} placeholder={dict.palletNumberPlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.client}>
            <Input name="clientName" />
          </FieldGroup>
          <VarietyField />
          <FieldGroup label={dict.shiftNumber}>
            <Input name="shiftNumber" />
          </FieldGroup>
          <FieldGroup label={dict.operationDate}>
            <Input
              name="operationDate"
              type="date"
              value={operationDate}
              onChange={(e) => {
                setOperationDate(e.target.value);
                const parsed = parseLocalDateOnly(e.target.value);
                setExpiryDate(parsed ? toDateOnlyString(addYears(parsed, 2)) : "");
              }}
            />
          </FieldGroup>
          <FieldGroup label={dict.expiryDate}>
            <Input name="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </FieldGroup>
          <FieldGroup label={dict.ph}>
            <Input name="acidityPh" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label={dict.complianceLevel}>
            <Select name="complianceLevel" defaultValue="">
              <option value="">—</option>
              <option value="GLOBALGAP">GLOBALG.A.P</option>
              <option value="SPRING">{dict.complianceOptionSpring}</option>
              <option value="LEAF">{dict.complianceOptionLeaf}</option>
              <option value="OTHER">{fullDict.common.other}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.complianceOther}>
            <Input name="complianceOther" />
          </FieldGroup>
        </div>
      </Card>

      <MeasurementFields key={isSuccess ? state : "initial"} grade={grade} format={lotFormat} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">{dict.saved}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? fullDict.common.saving : dict.logCheck}
      </Button>
    </form>
  );
}

function PalletInput({ pallets, placeholder }: { pallets: Pallet[]; placeholder: string }) {
  return (
    <>
      <Input name="palletNumber" list="pallet-suggestions" required placeholder={placeholder} />
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
  const fullDict = useTranslations();
  const dict = fullDict.postFreezeInspection;

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.sampleAndPackagingTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.sampleCollectionTime}>
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
          <FieldGroup label={dict.sampleWeightKg}>
            <Input name="sampleWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label={dict.cartonWeightKg}>
            <Input name="cartonWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label={dict.productTemperature}>
            <Input name="productTemperatureC" type="number" step="0.1" />
          </FieldGroup>
          {lotFormat === "WHOLE" && (
            <>
              <FieldGroup label={dict.fruitDiameterUncalibrated}>
                <Input name="fruitDiameterUncalibrated" placeholder={dict.fruitDiameterUncalibratedPlaceholder} />
              </FieldGroup>
              <FieldGroup
                label={dict.fruitDiameterCalibratedSmall.replace(
                  "{limit}",
                  `${limits.calibratedSmall}${limits.calibratedSmallIsClassII ? ` ${dict.classII}` : ""}`
                )}
              >
                <Input name="fruitDiameterCalibratedSmall" />
              </FieldGroup>
              <FieldGroup label={dict.fruitDiameterCalibratedMedium}>
                <Input name="fruitDiameterCalibratedMedium" />
              </FieldGroup>
              <FieldGroup label={dict.fruitDiameterCalibratedLarge}>
                <Input name="fruitDiameterCalibratedLarge" />
              </FieldGroup>
            </>
          )}
          {lotFormat === "SLICED" && (
            <>
              <FieldGroup label={dict.sliceThicknessNarrow}>
                <Input name="sliceThicknessNarrow" />
              </FieldGroup>
              <FieldGroup label={dict.sliceThicknessWide}>
                <Input name="sliceThicknessWide" />
              </FieldGroup>
            </>
          )}
          {lotFormat === "DICED" && (
            <>
              <FieldGroup label={dict.cubeSizeSmall}>
                <Input name="cubeSizeSmall" />
              </FieldGroup>
              <FieldGroup label={dict.cubeSizeLarge}>
                <Input name="cubeSizeLarge" />
              </FieldGroup>
            </>
          )}
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="packageClosureOk" /> {dict.packageClosureOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="dataLabelReviewOk" /> {dict.dataLabelReviewOk}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="fullPallet" /> {dict.fullPallet}
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.fruitQualityTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.brix}>
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <FieldGroup label={`${dict.fruitColor} (${fullDict.common.limit} ${limits.fruitColorPct} ${dict.ofBody})`}>
            <Input name="fruitColorPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label={dict.internalQuality}>
            <Input name="internalQualityPct" type="number" step="0.1" min="0" max="100" />
          </FieldGroup>
          <FieldGroup label={dict.foreignOdor}>
            <Input name="foreignOdor" placeholder={dict.nilPlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.foreignTaste}>
            <Input name="foreignTaste" placeholder={dict.nilPlaceholder} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.defectsTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <Pct name="overmaturePct" label={dict.overmature} limit={limits.overmature} {...bind("overmaturePct")} />
          <Pct name="incompleteMaturityPct" label={dict.incompleteMaturity} limit={limits.incompleteMaturity} {...bind("incompleteMaturityPct")} />
          <FieldGroup label={dict.capsuleRemains}>
            <Input name="capsuleRemainsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <FieldGroup label={dict.leafRemains}>
            <Input name="leafRemainsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <FieldGroup label={dict.stemFragments}>
            <Input name="stemFragmentsCount" type="number" step="0.1" min="0" />
          </FieldGroup>
          <Pct name="shapeDeformitiesPct" label={dict.shapeDeformities} limit={limits.shapeDeformities} {...bind("shapeDeformitiesPct")} />
          <Pct name="skinDamagePct" label={dict.skinDeformities} limit={limits.skinDeformities} {...bind("skinDamagePct")} />
          <Pct name="cohesiveClustersPct" label={dict.cohesiveClusters} limit={limits.cohesiveClusters} {...bind("cohesiveClustersPct")} />
          <Pct name="crushedBrokenFruitPct" label={dict[limits.crushedBrokenLabelKey]} limit={limits.crushedBroken} {...bind("crushedBrokenFruitPct")} />
          <Pct name="dryBruisesPct" label={dict.dryBruises} limit={limits.dryBruises} {...bind("dryBruisesPct")} />
          <Pct name="mechanicalFactorsPct" label={dict.mechanicalFactors} limit={limits.mechanicalFactors} {...bind("mechanicalFactorsPct")} />
          <Pct name="oxidationPct" label={dict.oxidation} limit={limits.oxidation} {...bind("oxidationPct")} />
          <Pct name="fungalInfectionPct" label={dict.fungalInfection} limit="0%" {...bind("fungalInfectionPct")} />
          <Pct name="insectsLarvaePct" label={dict.insectsLarvae} limit="0%" {...bind("insectsLarvaePct")} />
          <Pct name="insectInfestationPct" label={dict.insectInfestation} limit="0%" {...bind("insectInfestationPct")} />
          <Pct name="foreignBodiesPct" label={dict.foreignBodies} limit="0%" {...bind("foreignBodiesPct")} />
          <FieldGroup label={dict.frozenProductWait}>
            <Input name="frozenProductWaitMinutes" type="number" step="1" />
          </FieldGroup>
        </div>
        <p className={cn("text-xs font-medium", defectTotal > totalDefectsMax ? "text-red-600" : "text-slate-400")}>
          {dict.runningTotal.replace("{total}", defectTotal.toFixed(1)).replace("{limit}", limits.totalDefects)}
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.decisionLabel}>
            <Select name="decision" required value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
              <option value="ACCEPTED">{dict.acceptable}</option>
              <option value="REJECTED">{dict.unacceptable}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? dict.correctiveAction : dict.correctiveActionOptional}>
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
  const dict = useTranslations();
  return (
    <FieldGroup label={`${label} (${dict.common.limit} ${limit})`}>
      <Input name={name} type="number" step="0.1" min="0" max="100" value={value} onChange={onChange} />
    </FieldGroup>
  );
}
