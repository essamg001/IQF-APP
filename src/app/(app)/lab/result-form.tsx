"use client";

import { useActionState, useState } from "react";
import { updateLabResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { useTranslations } from "@/lib/i18n/locale-context";

type TestLine = {
  testName?: string | null;
  result?: string | null;
  unit?: string | null;
  measurementUncertainty?: string | null;
  methodRef?: string | null;
};

const EMPTY_LINE: TestLine = {};

type ResultData = {
  status: string;
  notes: string | null;
  certificateNumber: string | null;
  labName: string | null;
  clientName: string | null;
  clientAddress: string | null;
  attentionTo: string | null;
  sampleCode: string | null;
  sampleType: string | null;
  sampleSize: string | null;
  sampleCondition: string | null;
  sampleData: string | null;
  otherData: string | null;
  reportDate: Date | null;
  recommendation: string | null;
  preparedBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  sampleId: string | null;
  protocolNumber: string | null;
  samplingBagSerial: string | null;
  samplingPlace: string | null;
  methodName: string | null;
  analysisStartDate: Date | null;
  analysisEndDate: Date | null;
  personInCharge: string | null;
  resultsSummary: string | null;
  certificateFileName: string | null;
  certificateFileOriginalName: string | null;
  rejectedQuantityTonnes: number | null;
  rejectionReason: string | null;
  correctiveAction: string | null;
  totalPlateCountCfuG: number | null;
  testLines: TestLine[];
} | null | undefined;

function TestLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: TestLine;
  onChange: (next: TestLine) => void;
  onRemove: () => void;
}) {
  const dict = useTranslations().lab;
  const set = (key: keyof TestLine, value: string) => onChange({ ...line, [key]: value });
  return (
    <div className="grid grid-cols-6 items-end gap-2">
      <FieldGroup label={dict.testLabel}>
        <Input value={line.testName ?? ""} onChange={(e) => set("testName", e.target.value)} placeholder={dict.testPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.resultLabel}>
        <Input value={line.result ?? ""} onChange={(e) => set("result", e.target.value)} placeholder={dict.resultPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.unitLabel}>
        <Input value={line.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder={dict.unitPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.muLabel}>
        <Input value={line.measurementUncertainty ?? ""} onChange={(e) => set("measurementUncertainty", e.target.value)} placeholder={dict.muPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.methodRefLabel}>
        <Input value={line.methodRef ?? ""} onChange={(e) => set("methodRef", e.target.value)} placeholder={dict.methodRefPlaceholder} />
      </FieldGroup>
      <button type="button" onClick={onRemove} className="mb-2 justify-self-start text-xs text-red-600 hover:underline">
        {dict.removeLabel}
      </button>
    </div>
  );
}

export function ResultForm({
  resultId,
  labType,
  result,
}: {
  resultId: string;
  labType: "IN_HOUSE" | "EXTERNAL";
  result: ResultData;
}) {
  const [lines, setLines] = useState<TestLine[]>(result?.testLines?.length ? result.testLines : [{ ...EMPTY_LINE }]);
  const [cfuValue, setCfuValue] = useState<number | null>(result?.totalPlateCountCfuG ?? null);
  const [state, formAction, pending] = useActionState(updateLabResultAction.bind(null, resultId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().lab;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-emerald-800">{dict.certificateUploadSectionTitle}</p>
        <FieldGroup
          label={
            result?.certificateFileOriginalName
              ? dict.certificateFileCurrentLabel.replace("{name}", result.certificateFileOriginalName)
              : dict.certificateFileNewLabel
          }
        >
          <input type="file" name="certificateFile" accept="application/pdf,image/jpeg,image/png" className="block text-sm" />
          <p className="mt-1 text-xs text-slate-500">{dict.certificateFileHint}</p>
        </FieldGroup>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={dict.statusFieldLabel}>
          <Select name="status" defaultValue={result?.status ?? "SENT_TO_LAB"}>
            <option value="SENT_TO_LAB">{dict.statusStillAwaiting}</option>
            <option value="APPROVED">{dict.statusApproved}</option>
            <option value="FAILED_MINOR">{dict.statusFailedMinor}</option>
            <option value="FAILED_SEVERE">{dict.statusFailedSevere}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.totalPlateCountLabel}>
          <div className="flex items-center gap-2">
            <Input
              name="totalPlateCountCfuG"
              type="number"
              step="1"
              min="0"
              defaultValue={result?.totalPlateCountCfuG ?? ""}
              onChange={(e) => setCfuValue(e.target.value === "" ? null : Number(e.target.value))}
            />
            <CfuTierBadge cfuValue={cfuValue} className="shrink-0" />
          </div>
        </FieldGroup>
        <FieldGroup label={dict.personInChargeLabel}>
          <Input name="personInCharge" defaultValue={result?.personInCharge ?? ""} />
        </FieldGroup>
        <FieldGroup label={labType === "EXTERNAL" ? dict.testingDateLabel : dict.analysisDateLabel}>
          <Input name="analysisStartDate" type="date" defaultValue={result?.analysisStartDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.analysisEndedInLabel}>
          <Input name="analysisEndDate" type="date" defaultValue={result?.analysisEndDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label={dict.certificateNumberLabel}>
          <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.labNameLabel}>
          <Input name="labName" defaultValue={result?.labName ?? (labType === "EXTERNAL" ? "" : "Magrabi Administration Labs (MAFA)")} />
        </FieldGroup>
        <FieldGroup label={dict.clientLabel}>
          <Input name="clientName" defaultValue={result?.clientName ?? "Magrabi Agriculture Company"} />
        </FieldGroup>
        <FieldGroup label={dict.clientAddressLabel}>
          <Input name="clientAddress" defaultValue={result?.clientAddress ?? ""} />
        </FieldGroup>
        {labType === "EXTERNAL" && (
          <FieldGroup label={dict.attentionLabel}>
            <Input name="attentionTo" defaultValue={result?.attentionTo ?? ""} />
          </FieldGroup>
        )}
        <FieldGroup label={dict.sampleCodeLabel}>
          <Input name="sampleCode" defaultValue={result?.sampleCode ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.sampleTypeLabel}>
          <Input name="sampleType" defaultValue={result?.sampleType ?? ""} placeholder={dict.sampleTypePlaceholder} />
        </FieldGroup>
        {labType === "EXTERNAL" && (
          <>
            <FieldGroup label={dict.sampleSizeLabel}>
              <Input name="sampleSize" defaultValue={result?.sampleSize ?? ""} placeholder={dict.sampleSizePlaceholder} />
            </FieldGroup>
            <FieldGroup label={dict.sampleConditionLabel}>
              <Input name="sampleCondition" defaultValue={result?.sampleCondition ?? ""} placeholder={dict.sampleConditionPlaceholder} />
            </FieldGroup>
          </>
        )}
        {labType === "IN_HOUSE" && (
          <>
            <FieldGroup label={dict.dataOfSampleLabel}>
              <Input name="sampleData" defaultValue={result?.sampleData ?? ""} />
            </FieldGroup>
            <FieldGroup label={dict.otherDataLabel}>
              <Input name="otherData" defaultValue={result?.otherData ?? ""} />
            </FieldGroup>
          </>
        )}
        <FieldGroup label={dict.reportDateLabel}>
          <Input name="reportDate" type="date" defaultValue={result?.reportDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>

      {labType === "EXTERNAL" && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">{dict.residuePanelSummary}</summary>
          <div className="mt-2 grid grid-cols-4 gap-3">
            <FieldGroup label={dict.sampleIdLabel}>
              <Input name="sampleId" defaultValue={result?.sampleId ?? ""} />
            </FieldGroup>
            <FieldGroup label={dict.protocolNumberLabel}>
              <Input name="protocolNumber" defaultValue={result?.protocolNumber ?? ""} />
            </FieldGroup>
            <FieldGroup label={dict.samplingBagSerialLabel}>
              <Input name="samplingBagSerial" defaultValue={result?.samplingBagSerial ?? ""} />
            </FieldGroup>
            <FieldGroup label={dict.samplingPlaceLabel}>
              <Input name="samplingPlace" defaultValue={result?.samplingPlace ?? ""} />
            </FieldGroup>
            <FieldGroup label={dict.methodNameLabel}>
              <Input name="methodName" defaultValue={result?.methodName ?? ""} />
            </FieldGroup>
          </div>
        </details>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">{dict.testsLabel}</p>
          <Button type="button" variant="secondary" className="text-xs" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            {dict.addTest}
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {lines.map((line, i) => (
            <TestLineRow
              key={i}
              line={line}
              onChange={(next) => setLines(lines.map((l, j) => (j === i ? next : l)))}
              onRemove={() => setLines(lines.filter((_, j) => j !== i))}
            />
          ))}
          {lines.length === 0 && <p className="text-sm text-slate-400">{dict.noTestsAddedYet}</p>}
        </div>
        <input type="hidden" name="testLinesJson" value={JSON.stringify(lines)} />
      </div>

      {labType === "IN_HOUSE" && (
        <>
          <FieldGroup label={dict.recommendationLabel}>
            <Input name="recommendation" defaultValue={result?.recommendation ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.preparedByLabel}>
            <Input name="preparedBy" defaultValue={result?.preparedBy ?? ""} />
          </FieldGroup>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label={labType === "EXTERNAL" ? dict.reviewedByExternalLabel : dict.reviewedByInHouseLabel}>
          <Input name="reviewedBy" defaultValue={result?.reviewedBy ?? ""} />
        </FieldGroup>
        <FieldGroup label={labType === "EXTERNAL" ? dict.approvedByExternalLabel : dict.approvedByInHouseLabel}>
          <Input name="approvedBy" defaultValue={result?.approvedBy ?? ""} />
        </FieldGroup>
      </div>

      <FieldGroup label={dict.resultsSummaryLabel}>
        <Input
          name="resultsSummary"
          placeholder={dict.resultsSummaryPlaceholder}
          defaultValue={result?.resultsSummary ?? ""}
        />
      </FieldGroup>
      <FieldGroup label={dict.notesLabel}>
        <Input name="notes" defaultValue={result?.notes ?? ""} />
      </FieldGroup>

      <div className="rounded-md border border-red-100 bg-red-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-red-700">{dict.rejectedSampleDetailsTitle}</p>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label={dict.rejectedQuantityLabel}>
            <Input
              name="rejectedQuantityTonnes"
              type="number"
              step="0.1"
              min="0"
              defaultValue={result?.rejectedQuantityTonnes ?? ""}
            />
          </FieldGroup>
          <FieldGroup label={dict.reasonLabel}>
            <Input name="rejectionReason" placeholder={dict.reasonPlaceholder} defaultValue={result?.rejectionReason ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.correctiveActionLabel}>
            <Input name="correctiveAction" placeholder={dict.correctiveActionPlaceholder} defaultValue={result?.correctiveAction ?? ""} />
          </FieldGroup>
        </div>
      </div>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? dict.saving : dict.saveResult}
      </Button>
    </form>
  );
}
