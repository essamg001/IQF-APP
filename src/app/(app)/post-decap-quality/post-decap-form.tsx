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
import { QC_NUMBERS } from "@/lib/qc";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  factoryId,
  date,
  shiftType,
  fields,
  fieldByReceiptNote,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  fields: FieldOption[];
  fieldByReceiptNote: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(createPostDecapCheckAction, undefined);
  const dict = useTranslations().postDecapQuality;

  const [receiptNoteNo, setReceiptNoteNo] = useState("");

  const isSuccess = typeof state === "string" && state.startsWith("ok:");
  const errorMessage = typeof state === "string" && !isSuccess ? state : undefined;
  const decoded = isSuccess ? decodeActionResult(state) : null;

  const matchedFieldName = fieldByReceiptNote[receiptNoteNo.trim()] ?? "";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.traceabilityTitle}</h2>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.harvestTicketSerial}>
            <Input
              name="receiptNoteNo"
              value={receiptNoteNo}
              onChange={(e) => setReceiptNoteNo(e.target.value)}
              placeholder={dict.harvestTicketSerialPlaceholder}
            />
          </FieldGroup>
          <FieldGroup label={dict.fieldPlot}>
            <FieldNameInput key={matchedFieldName || "manual"} defaultValue={matchedFieldName} fields={fields} placeholder={dict.fieldPlotPlaceholder} />
          </FieldGroup>
        </div>
        {receiptNoteNo && !matchedFieldName && <p className="text-xs text-amber-600">{dict.noArrivalFound}</p>}
      </Card>

      <SampleFields key={isSuccess ? state : "initial"} />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {decoded && <QualityLimitWarning violations={decoded.violations} />}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">{dict.saved}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? dict.saving : dict.logCheck}
      </Button>
    </form>
  );
}

function FieldNameInput({
  defaultValue,
  fields,
  placeholder,
}: {
  defaultValue: string;
  fields: FieldOption[];
  placeholder: string;
}) {
  return (
    <>
      <Input name="fieldName" list="field-suggestions" defaultValue={defaultValue} placeholder={placeholder} />
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
  const dict = useTranslations().postDecapQuality;

  return (
    <>
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.deliveryIdentityTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.variety}>
            <Input name="varietyName" />
          </FieldGroup>
          <FieldGroup label={dict.client}>
            <Input name="clientName" />
          </FieldGroup>
          <FieldGroup label={dict.sampleNo}>
            <Input name="sampleNo" required />
          </FieldGroup>
          <FieldGroup label={dict.processingLine}>
            <Input name="processingLine" />
          </FieldGroup>
          <FieldGroup label={dict.sampleCollectionTime}>
            <Input name="sampleCollectionTime" type="datetime-local" />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.physicalMeasurementsTitle}</h2>
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label={dict.plateWeight}>
            <Input name="crateWeightKg" type="number" step="0.01" />
          </FieldGroup>
          <FieldGroup label={dict.fruitDiameter}>
            <Input name="sizeCaliber" placeholder="25-40mm" />
          </FieldGroup>
          <FieldGroup label={dict.brix}>
            <Input name="brix" type="number" step="0.1" required />
          </FieldGroup>
          <Pct name="fruitColorPct" label={dict.fruitColor} />
          <Pct name="internalQualityPct" label={dict.internalQuality} />
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
          <Pct name="incompleteMaturityPct" label={dict.incompleteMaturity} {...bind("incompleteMaturityPct")} />
          <Pct name="moldSignsPct" label={dict.moldSigns} {...bind("moldSignsPct")} />
          <Pct name="mouldPct" label={dict.mould} {...bind("mouldPct")} />
          <Pct name="capsuleRemainsPct" label={dict.capsuleRemains} {...bind("capsuleRemainsPct")} />
          <Pct name="birdFoodPct" label={dict.birdEaten} {...bind("birdFoodPct")} />
          <Pct name="overmaturePct" label={dict.overmature} {...bind("overmaturePct")} />
          <Pct name="skinDamagePct" label={dict.shellDeformities} {...bind("skinDamagePct")} />
          <Pct name="shapeDeformitiesPct" label={dict.shapeDeformities} {...bind("shapeDeformitiesPct")} />
          <Pct name="seedClusteringPct" label={dict.seedClustering} {...bind("seedClusteringPct")} />
          <Pct name="bruisesPct" label={dict.bruises} {...bind("bruisesPct")} />
          <Pct name="dryCavitiesPct" label={dict.dryCavities} {...bind("dryCavitiesPct")} />
          <Pct name="overDecappingPct" label={dict.overDecapping} {...bind("overDecappingPct")} />
          <Pct name="oxidationPct" label={dict.oxidation} {...bind("oxidationPct")} />
          <Pct name="sandDustPct" label={dict.sandDust} {...bind("sandDustPct")} />
          <Pct name="insectsLarvaePct" label={dict.insectsLarvae} {...bind("insectsLarvaePct")} />
          <Pct name="foreignBodiesPct" label={dict.foreignBodies} {...bind("foreignBodiesPct")} />
          <FieldGroup label={dict.leafStemRemains}>
            <Input name="leafStemRemainsCount" type="number" step="1" min="0" />
          </FieldGroup>
          <Pct name="brokenUncleanPalletsPct" label={dict.brokenUncleanPallets} {...bind("brokenUncleanPalletsPct")} />
          <Pct name="unfumigatedPalletsPct" label={dict.unfumigatedPallets} {...bind("unfumigatedPalletsPct")} />
          <Pct name="brokenUncleanCratesPct" label={dict.brokenUncleanCrates} {...bind("brokenUncleanCratesPct")} />
        </div>
        <p className={cn("text-xs font-medium", defectTotal > TOTAL_DEFECTS_LIMIT ? "text-red-600" : "text-slate-400")}>
          {dict.runningTotal.replace("{total}", defectTotal.toFixed(1)).replace("{limit}", String(TOTAL_DEFECTS_LIMIT))}
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.qcApprover}>
            <Select name="decapQcApprover" required defaultValue="">
              <option value="" disabled>
                {dict.qcApproverPlaceholder}
              </option>
              {QC_NUMBERS.map((qc) => (
                <option key={qc} value={qc}>
                  {qc}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.decisionLabel}>
            <Select
              name="decision"
              required
              value={decision}
              onChange={(e) => setDecision(e.target.value as typeof decision)}
            >
              <option value="ACCEPTED">{dict.conforming}</option>
              <option value="REJECTED">{dict.nonconforming}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={decision === "REJECTED" ? dict.correctiveAction : dict.correctiveActionOptional}>
            <Input
              name="notes"
              placeholder={decision === "REJECTED" ? dict.correctiveActionPlaceholder : undefined}
              required={decision === "REJECTED"}
            />
          </FieldGroup>
        </div>
        {decision === "REJECTED" && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label={dict.divertedTo}>
              <Input name="divertedTo" placeholder={dict.divertedToPlaceholder} />
            </FieldGroup>
            <FieldGroup label={dict.retraining}>
              <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="retrainingRequested" className="h-4 w-4 rounded border-slate-300" />
                {dict.requested}
              </label>
            </FieldGroup>
          </div>
        )}
      </Card>
    </>
  );
}
