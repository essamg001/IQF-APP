"use client";

import { useActionState, useState } from "react";
import { addAuditFindingAction } from "./actions";
import { Input, Select, FieldGroup, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function FindingForm({ visitId }: { visitId: string }) {
  const [state, formAction, pending] = useActionState(addAuditFindingAction.bind(null, visitId), undefined);
  const [category, setCategory] = useState<"STRENGTH" | "ISSUE">("STRENGTH");
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().visits;

  return (
    <form action={formAction} className="space-y-3 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label={dict.categoryLabel}>
          <Select name="category" value={category} onChange={(e) => setCategory(e.target.value as "STRENGTH" | "ISSUE")}>
            <option value="STRENGTH">{dict.categoryStrength}</option>
            <option value="ISSUE">{dict.categoryIssue}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.areaLabel}>
          <Input name="area" placeholder={dict.areaPlaceholder} />
        </FieldGroup>
        {category === "ISSUE" && (
          <FieldGroup label={dict.severityLabel}>
            <Select name="severity" defaultValue="MINOR">
              <option value="MINOR">{dict.severityMinor}</option>
              <option value="MAJOR">{dict.severityMajor}</option>
              <option value="CRITICAL">{dict.severityCritical}</option>
            </Select>
          </FieldGroup>
        )}
      </div>
      <FieldGroup label={dict.descriptionLabel}>
        <Textarea name="description" required />
      </FieldGroup>
      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? dict.saving : dict.addFinding}
      </Button>
    </form>
  );
}
