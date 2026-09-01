"use client";

import { useActionState } from "react";
import { updateMrlResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const dict = useTranslations().lab;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <div className="rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-emerald-800">{dict.certificateUploadSectionTitle}</p>
        <FieldGroup label={dict.certificateFileMrlLabel}>
          <Input name="certificateFile" type="file" accept=".pdf,.jpg,.jpeg,.png" />
        </FieldGroup>
        {result?.certificateFileName && (
          <a
            href={`/api/files/certificates/${result.certificateFileName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-emerald-700 hover:underline"
          >
            {dict.viewCurrentCertificate.replace("{name}", result.certificateFileOriginalName ?? dict.fileFallback)}
          </a>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FieldGroup label={dict.statusFieldLabel}>
          <Select name="status" defaultValue={result?.status ?? "PENDING"}>
            <option value="PENDING">{dict.statusPending}</option>
            <option value="SENT_TO_LAB">{dict.statusSentToLab}</option>
            <option value="APPROVED">{dict.statusApproved}</option>
            <option value="FAILED">{dict.statusFailed}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.labNameLabel}>
          <Input name="labName" defaultValue={result?.labName ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.certificateResultNoLabel}>
          <Input name="certificateNumber" defaultValue={result?.certificateNumber ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.sampleCodeLabel}>
          <Input name="sampleCode" defaultValue={result?.sampleCode ?? ""} />
        </FieldGroup>
        <FieldGroup label={dict.reportDateLabel}>
          <Input name="reportDate" type="date" defaultValue={dateInputValue(result?.reportDate ?? null)} />
        </FieldGroup>
        <FieldGroup label={dict.analysisDateLabel}>
          <Input name="analysisDate" type="date" defaultValue={dateInputValue(result?.analysisDate ?? null)} />
        </FieldGroup>
      </div>
      <FieldGroup label={dict.notesLabel}>
        <Input name="notes" defaultValue={result?.notes ?? ""} />
      </FieldGroup>
      <FieldGroup label={dict.rejectionReasonIfFailedLabel}>
        <Input name="rejectionReason" defaultValue={result?.rejectionReason ?? ""} />
      </FieldGroup>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? dict.saving : dict.save}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
