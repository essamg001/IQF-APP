"use client";

import { useState } from "react";
import { updateLabResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type TestLine = { testName?: string | null; result?: string | null; unit?: string | null; methodRef?: string | null };

const EMPTY_LINE: TestLine = {};

type ResultData = {
  status: string;
  notes: string | null;
  certificateNumber: string | null;
  labName: string | null;
  sampleId: string | null;
  protocolNumber: string | null;
  samplingBagSerial: string | null;
  samplingPlace: string | null;
  methodName: string | null;
  sampleCode: string | null;
  clientName: string | null;
  clientAddress: string | null;
  sampleType: string | null;
  sampleData: string | null;
  otherData: string | null;
  reportDate: Date | null;
  recommendation: string | null;
  preparedBy: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
  analysisStartDate: Date | null;
  analysisEndDate: Date | null;
  personInCharge: string | null;
  resultsSummary: string | null;
  certificateFileName: string | null;
  certificateFileOriginalName: string | null;
  rejectedQuantityTonnes: number | null;
  rejectionReason: string | null;
  correctiveAction: string | null;
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
    <div className="grid grid-cols-5 items-end gap-2">
      <FieldGroup label="Test">
        <Input value={line.testName ?? ""} onChange={(e) => set("testName", e.target.value)} placeholder="e.g. Aerobic total plate count 30°C" />
      </FieldGroup>
      <FieldGroup label="Result">
        <Input value={line.result ?? ""} onChange={(e) => set("result", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="Unit">
        <Input value={line.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="CFU/gm" />
      </FieldGroup>
      <FieldGroup label="Method Ref">
        <Input value={line.methodRef ?? ""} onChange={(e) => set("methodRef", e.target.value)} placeholder="ISO 4833 2013" />
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
  const [lines, setLines] = useState<TestLine[]>(result?.testLines?.length ? result.testLines : labType === "IN_HOUSE" ? [{ ...EMPTY_LINE }] : []);

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
        <FieldGroup label="Person In Charge">
          <Input name="personInCharge" defaultValue={result?.personInCharge ?? ""} />
        </FieldGroup>
        <FieldGroup label="Analysis Date">
          <Input name="analysisStartDate" type="date" defaultValue={result?.analysisStartDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
        <FieldGroup label="Analysis Ended In">
          <Input name="analysisEndDate" type="date" defaultValue={result?.analysisEndDate?.toISOString().slice(0, 10) ?? ""} />
        </FieldGroup>
      </div>

      {labType === "EXTERNAL" ? (
        <div className="grid grid-cols-4 gap-3">
          <FieldGroup label="Certificate Number">
            <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
          </FieldGroup>
          <FieldGroup label="Lab Name">
            <Input name="labName" defaultValue={result?.labName ?? ""} />
          </FieldGroup>
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
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <FieldGroup label="Certificate Number">
              <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sample Code">
              <Input name="sampleCode" defaultValue={result?.sampleCode ?? ""} />
            </FieldGroup>
            <FieldGroup label="Client">
              <Input name="clientName" defaultValue={result?.clientName ?? "Magrabi Agriculture"} />
            </FieldGroup>
            <FieldGroup label="Client Address">
              <Input name="clientAddress" defaultValue={result?.clientAddress ?? ""} />
            </FieldGroup>
            <FieldGroup label="Sample Type">
              <Input name="sampleType" defaultValue={result?.sampleType ?? ""} />
            </FieldGroup>
            <FieldGroup label="Data of Sample">
              <Input name="sampleData" defaultValue={result?.sampleData ?? ""} />
            </FieldGroup>
            <FieldGroup label="Other Data">
              <Input name="otherData" defaultValue={result?.otherData ?? ""} />
            </FieldGroup>
            <FieldGroup label="Report Date">
              <Input name="reportDate" type="date" defaultValue={result?.reportDate?.toISOString().slice(0, 10) ?? ""} />
            </FieldGroup>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">Tests (نتائج تحليل ميكروبيولوجي)</p>
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

          <FieldGroup label="Recommendation">
            <Input name="recommendation" defaultValue={result?.recommendation ?? ""} />
          </FieldGroup>

          <div className="grid grid-cols-3 gap-3">
            <FieldGroup label="Prepared By (Documents Section)">
              <Input name="preparedBy" defaultValue={result?.preparedBy ?? ""} />
            </FieldGroup>
            <FieldGroup label="Reviewed By (Head Section Lab)">
              <Input name="reviewedBy" defaultValue={result?.reviewedBy ?? ""} />
            </FieldGroup>
            <FieldGroup label="Approved By (Labs Director)">
              <Input name="approvedBy" defaultValue={result?.approvedBy ?? ""} />
            </FieldGroup>
          </div>
        </>
      )}

      <FieldGroup label="Results Summary">
        <Input
          name="resultsSummary"
          placeholder={labType === "EXTERNAL" ? "e.g. Chlorates: Not detected. Perchlorates: Not detected." : "Free-text summary, if needed"}
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
