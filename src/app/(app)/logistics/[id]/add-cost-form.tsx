"use client";

import { useActionState } from "react";
import { addContainerCostAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function AddCostForm({ containerId }: { containerId: string }) {
  const boundAction = addContainerCostAction.bind(null, containerId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().logistics;
  const COST_CATEGORY_LABEL: Record<string, string> = {
    DEMURRAGE: dict.costDemurrage,
    DETENTION: dict.costDetention,
    STORAGE: dict.costStorage,
    CUSTOMS_DELAY: dict.costCustomsDelay,
    DOCUMENTATION: dict.costDocumentation,
    INSPECTION: dict.costInspection,
    REROUTING: dict.costRerouting,
    OTHER: dict.costOther,
  };

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label={dict.categoryLabel}>
        <Select name="category" defaultValue="OTHER">
          {Object.entries(COST_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.amountUsdLabel}>
        <Input name="amountUsd" type="number" step="0.01" min="0.01" required className="w-32" />
      </FieldGroup>
      <FieldGroup label={dict.dateLabel}>
        <Input name="incurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label={dict.descriptionLabel}>
        <Input name="description" placeholder={dict.descriptionPlaceholder} className="w-56" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? dict.adding : dict.addCost}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
