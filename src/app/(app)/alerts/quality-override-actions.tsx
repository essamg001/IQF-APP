"use client";

import { useActionState, useState } from "react";
import { rejectQualityCheckAction, approveAtRiskAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function QualityOverrideActions({ checkId }: { checkId: string }) {
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [state, formAction, pending] = useActionState(approveAtRiskAction.bind(null, checkId), undefined);
  const errorMessage = typeof state === "string" && state !== "ok" ? state : undefined;
  const { alerts: dict, common } = useTranslations();

  if (!showApproveForm) {
    return (
      <div className="flex gap-2">
        <form action={rejectQualityCheckAction.bind(null, checkId)}>
          <Button type="submit" variant="danger" className="text-xs">
            {dict.reject}
          </Button>
        </form>
        <Button type="button" variant="secondary" className="text-xs" onClick={() => setShowApproveForm(true)}>
          {dict.approveAtRiskButton}
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-64 space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
      <p className="text-xs font-medium text-amber-800">{dict.signingOffWarning}</p>
      <FieldGroup label={dict.yourName}>
        <Input name="name" required className="text-sm" />
      </FieldGroup>
      <FieldGroup label={dict.signatureLabel}>
        <Input name="signature" required className="text-sm" placeholder={dict.signaturePlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.noteOptionalLabel}>
        <Input name="note" className="text-sm" />
      </FieldGroup>
      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="text-xs">
          {pending ? dict.signing : dict.confirmAndSign}
        </Button>
        <Button type="button" variant="ghost" className="text-xs" onClick={() => setShowApproveForm(false)}>
          {common.cancel}
        </Button>
      </div>
    </form>
  );
}
