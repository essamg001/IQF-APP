"use client";

import { useState } from "react";
import { updateLabResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { CfuTierBadge } from "@/components/cfu-tier-badge";

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
  const set = (key: keyof TestLine, value: string) => onChange({ ...line, [key]: value });
  return (
    <div className="grid grid-cols-6 items-end gap-2">
      <FieldGroup label="Test">
        <Input value={line.testName ?? ""} onChange={(e) => set("testName", e.target.value)} placeholder="e.g. Aerobic total plate count 30°C" />
      </FieldGroup>
      <FieldGroup label="Result">
        <Input value={line.result ?? ""} onChange={(e) => set("result", e.target.value)} placeholder="e.g. 3000 cfu/g" />
      </FieldGroup>
      <FieldGroup label="Unit">
        <Input value={line.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="CFU/gm" />
      </FieldGroup>
      <FieldGroup label="MU">
        <Input value={line.measurementUncertainty ?? ""} onChange={(e) => set("measurementUncertainty", e.target.value)} placeholder="± 0.015" />
      </FieldGroup>
      <FieldGroup label="Method Ref">
        <Input value={line.methodRef ?? ""} onChange={(e) => set("methodRef", e.target.value)} placeholder="ISO 4833-1:2013" />
      </FieldGroup>
      <button type="button" onClick={onRemove} className="mb-2 justify-self-start text-xs text-red-600 hover:underline">
        Remove
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

  return (
    <form action={updateLabResultAction.bind(null, resultId)} className="mt-3 space-y-3" encType="multipart/form-data">
      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Status">
          <Select name="status" defaultValue={result?.status ?? "SENT_TO_LAB"}>
            <option value="SENT_TO_LAB">Still awaiting result</option>
            <option value="APPROVED">Approved</option>
            <option value="FAILED_MINOR">Failed — Minor</option>
            <option value="FAILED_SEVERE">Failed — Severe</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Total Plate Count (cfu/g)">
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
        <FieldGroup label="Person In Charge">
          <Input name="personInCharge" defaultValue={result?.personInCharge ?? ""} />
        </FieldGroup>
        <FieldGroup label={labType === "EXTERNAL" ? "Testing Date" : "Analysis Date"}>
          <Input name="analysisStartDate" type="date" defaultValue={result?.analysisStartDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
        <FieldGroup label="Analysis Ended In">
          <Input name="analysisEndDate" type="date" defaultValue={result?.analysisEndDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <FieldGroup label="Certificate Number">
          <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label="Lab Name">
          <Input name="labName" defaultValue={result?.labName ?? (labType === "EXTERNAL" ? "" : "Magrabi Administration Labs (MAFA)")} />
        </FieldGroup>
        <FieldGroup label="Client">
          <Input name="clientName" defaultValue={result?.clientName ?? "Magrabi Agriculture Company"} />
        </FieldGroup>
        <FieldGroup label="Client Address">
          <Input name="clientAddress" defaultValue={result?.clientAddress ?? ""} />
        </FieldGroup>
        {labType === "EXTERNAL" && (
          <FieldGroup label="Attention">
            <Input name="attentionTo" defaultValue={result?.attentionTo ?? ""} />
          </FieldGroup>
        )}
        <FieldGroup label="Sample Code">
          <Input name="sampleCode" defaultValue={result?.sampleCode ?? ""} />
        </FieldGroup>
        <FieldGroup label="Sample Type">
          <Input name="sampleType" defaultValue={result?.sampleType ?? ""} placeholder="e.g. Strawberry Frozen, Lot, Sample Date" />
        </FieldGroup>
        {labType === "EXTERNAL" && (
          <>
            <FieldGroup label="Sample Size">
              <Input name="sampleSize" defaultValue={result?.sampleSize ?? ""} placeholder="e.g. 1 kg" />
            </FieldGroup>
            <FieldGroup label="Sample Condition">
              <Input name="sampleCondition" defaultValue={result?.sampleCondition ?? ""} placeholder="e.g. Kept frozen" />
            </FieldGroup>
          </>
        )}
        {labType === "IN_HOUSE" && (
          <>
            <FieldGroup label="Data of Sample">
              <Input name="sampleData" defaultValue={result?.sampleData ?? ""} />
            </FieldGroup>
            <FieldGroup label="Other Data">
              <Input name="otherData" defaultValue={result?.otherData ?? ""} />
            </FieldGroup>
          </>
        )}
        <FieldGroup label="Report Date">
          <Input name="reportDate" type="date" defaultValue={result?.reportDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>

      {labType === "EXTERNAL" && (
        <details className="text-xs text-slate-500">
          <summary className="cursor-pointer">Residue/contaminant panel fields (older certificate format)</summary>
          <div className="mt-2 grid grid-cols-4 gap-3">
            <FieldGroup label="Sample ID">
              <Input name="sampleId" defaultValue={result?.sampleId ?? ""} />
            </FieldGroup>
            <FieldGroup label="Protocol Number">
              <Input name="protocolNumber" defaultValue={result?.protocolNumber ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sampling Bag Serial">
              <Input name="samplingBagSerial" defaultValue={result?.samplingBagSerial ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sampling Place">
              <Input name="samplingPlace" defaultValue={result?.samplingPlace ?? ""} />
            </FieldGroup>
            <FieldGroup label="Method Name">
              <Input name="methodName" defaultValue={result?.methodName ?? ""} />
            </FieldGroup>
          </div>
        </details>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700">Tests</p>
          <Button type="button" variant="secondary" className="text-xs" onClick={() => setLines([...lines, { ...EMPTY_LINE }])}>
            Add test
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
          {lines.length === 0 && <p className="text-sm text-slate-400">No tests added yet.</p>}
        </div>
        <input type="hidden" name="testLinesJson" value={JSON.stringify(lines)} />
      </div>

      {labType === "IN_HOUSE" && (
        <>
          <FieldGroup label="Recommendation">
            <Input name="recommendation" defaultValue={result?.recommendation ?? ""} />
          </FieldGroup>
          <FieldGroup label="Prepared By (Documents Section)">
            <Input name="preparedBy" defaultValue={result?.preparedBy ?? ""} />
          </FieldGroup>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label={labType === "EXTERNAL" ? "Reviewed By (e.g. Quality Manager)" : "Reviewed By (Head Section Lab)"}>
          <Input name="reviewedBy" defaultValue={result?.reviewedBy ?? ""} />
        </FieldGroup>
        <FieldGroup label={labType === "EXTERNAL" ? "Approved By (e.g. Lab Manager)" : "Approved By (Labs Director)"}>
          <Input name="approvedBy" defaultValue={result?.approvedBy ?? ""} />
        </FieldGroup>
      </div>

      <FieldGroup label="Results Summary">
        <Input
          name="resultsSummary"
          placeholder="Free-text summary, if needed"
          defaultValue={result?.resultsSummary ?? ""}
        />
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" defaultValue={result?.notes ?? ""} />
      </FieldGroup>

      <div className="rounded-md border border-red-100 bg-red-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-red-700">Rejected sample details (only if Failed — Minor/Severe)</p>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="Rejected quantity (tonnes)">
            <Input
              name="rejectedQuantityTonnes"
              type="number"
              step="0.1"
              min="0"
              defaultValue={result?.rejectedQuantityTonnes ?? ""}
            />
          </FieldGroup>
          <FieldGroup label="Reason">
            <Input name="rejectionReason" placeholder="Why it failed spec" defaultValue={result?.rejectionReason ?? ""} />
          </FieldGroup>
          <FieldGroup label="Corrective action">
            <Input name="correctiveAction" placeholder="What was done about it" defaultValue={result?.correctiveAction ?? ""} />
          </FieldGroup>
        </div>
      </div>
      <FieldGroup label={result?.certificateFileOriginalName ? `Certificate File (currently: ${result.certificateFileOriginalName})` : "Certificate File (PDF, JPG, or PNG)"}>
        <input type="file" name="certificateFile" accept="application/pdf,image/jpeg,image/png" className="block text-sm" />
      </FieldGroup>
      <Button type="submit" variant="secondary">
        Save result
      </Button>
    </form>
  );
}
