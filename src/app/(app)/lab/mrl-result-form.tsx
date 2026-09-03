"use client";

import { useActionState, useState } from "react";
import { updateMrlResultAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LabPipelineTracker } from "./lab-pipeline-tracker";
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
  const [status, setStatus] = useState(result?.status ?? "PENDING");
  const [hasNewCertificate, setHasNewCertificate] = useState(false);

  const isResolved = status === "APPROVED" || status === "FAILED";
  const hasCertificate = hasNewCertificate || !!result?.certificateFileName;
  const pipelineStage = isResolved ? "resolved" : "atLab";

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <LabPipelineTracker
        current={pipelineStage}
        labels={[dict.awaitingDispatchTitle, dict.sentAwaitingResultTitle, dict.resolvedTitle]}
      />

      <div className="rounded-md border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-emerald-800">{dict.certificateUploadSectionTitle}</p>
        <div className="flex flex-wrap items-end gap-3">
          <FieldGroup label={dict.certificateFileMrlLabel}>
            <Input
              name="certificateFile"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setHasNewCertificate(!!e.target.files?.length)}
            />
          </FieldGroup>
          <FieldGroup label={dict.statusFieldLabel}>
            <Select name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-52">
              <option value="PENDING">{dict.statusPending}</option>
              <option value="SENT_TO_LAB">{dict.statusSentToLab}</option>
              <option value="APPROVED">{dict.statusApproved}</option>
              <option value="FAILED">{dict.statusFailed}</option>
            </Select>
          </FieldGroup>
        </div>
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
        <p className="mt-1 text-xs text-slate-500">{dict.statusFieldHint}</p>
        {!isResolved && hasCertificate && (
          <p className="mt-2 text-xs font-medium text-amber-700">{dict.certificateAttachedStillAwaitingWarning}</p>
        )}
        {isResolved && !hasCertificate && (
          <p className="mt-2 text-xs font-medium text-amber-700">{dict.resolvedNoCertificateWarning}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
