"use client";

import { useActionState } from "react";
import { confirmAndPlanStructuralIssueAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function PlanForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(confirmAndPlanStructuralIssueAction.bind(null, issueId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.structuralIssues;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <FieldGroup label={t.planFormLabel}>
        <Input name="proposedPlan" required placeholder={t.planFormPlaceholder} />
      </FieldGroup>
      <FieldGroup label={t.planFormTargetDate}>
        <Input name="proposedCompletionDate" type="date" required />
      </FieldGroup>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.common.saving : t.confirmCommit}
      </Button>
    </form>
  );
}
