"use client";

import { useActionState } from "react";
import { updateMrlResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type MrlResultData = {
  status: string;
  labName: string | null;
  certificateNumber: string | null;
  sampleCode: string | null;
  reportDate: Date | null;
  analysisDate: Date | null;
  notes: string | null;
  rejectionReason: string | null;
  certificateFileName: string | null;
  certificateFileOriginalName: string | null;
} | null | undefined;

const dateInputValue = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function MrlResultForm({ resultId, result }: { resultId: string; result: MrlResultData }) {
  const [state, formAction, pending] = useActionState(updateMrlResultAction.bind(null, resultId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FieldGroup label="Status">
          <Select name="status" defaultValue={result?.status ?? "PENDING"}>
            <option value="PENDING">Pending</option>
            <option value="SENT_TO_LAB">Sent to Lab</option>
            <option value="APPROVED">Approved</option>
            <option value="FAILED">Failed</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Lab Name">
          <Input name="labName" defaultValue={result?.labName ?? ""} />
        </FieldGroup>
        <FieldGroup label="Certificate/Result No.">
          <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label="Sample Code">
          <Input name="sampleCode" defaultValue={result?.sampleCode ?? ""} />
        </FieldGroup>
        <FieldGroup label="Report Date">
          <Input name="reportDate" type="date" defaultValue={dateInputValue(result?.reportDate ?? null)} />
        </FieldGroup>
        <FieldGroup label="Analysis Date">
          <Input name="analysisDate" type="date" defaultValue={dateInputValue(result?.analysisDate ?? null)} />
        </FieldGroup>
        <FieldGroup label="Certificate File (PDF/JPG/PNG)">
          <Input name="certificateFile" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        </FieldGroup>
      </div>
      {result?.certificateFileName && (
        <a
          href={`/api/files/certificates/${result.certificateFileName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-700 hover:underline"
        >
          View current certificate ({result.certificateFileOriginalName ?? "file"})
        </a>
      )}
      <FieldGroup label="Notes">
        <Input name="notes" defaultValue={result?.notes ?? ""} />
      </FieldGroup>
      <FieldGroup label="Rejection reason (if Failed)">
        <Input name="rejectionReason" defaultValue={result?.rejectionReason ?? ""} />
      </FieldGroup>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
