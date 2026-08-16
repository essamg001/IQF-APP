"use client";

import { useActionState } from "react";
import { confirmAndPlanStructuralIssueAction } from "../actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function PlanForm({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(confirmAndPlanStructuralIssueAction.bind(null, issueId), undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <FieldGroup label="Repair plan">
        <Input name="proposedPlan" required placeholder="What will be done to fix it" />
      </FieldGroup>
      <FieldGroup label="Target completion date">
        <Input name="proposedCompletionDate" type="date" required />
      </FieldGroup>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Confirm & Commit to Plan"}
      </Button>
    </form>
  );
}
