"use client";

import { useActionState } from "react";
import { addContainerCostAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const COST_CATEGORY_LABEL: Record<string, string> = {
  DEMURRAGE: "Demurrage",
  DETENTION: "Detention",
  STORAGE: "Storage",
  CUSTOMS_DELAY: "Customs Delay",
  DOCUMENTATION: "Documentation",
  INSPECTION: "Inspection",
  REROUTING: "Rerouting",
  OTHER: "Other",
};

export function AddCostForm({ containerId }: { containerId: string }) {
  const boundAction = addContainerCostAction.bind(null, containerId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <FieldGroup label="Category">
        <Select name="category" defaultValue="OTHER">
          {Object.entries(COST_CATEGORY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Amount (USD)">
        <Input name="amountUsd" type="number" step="0.01" min="0.01" required className="w-32" />
      </FieldGroup>
      <FieldGroup label="Date">
        <Input name="incurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label="Description">
        <Input name="description" placeholder="e.g. 3 extra days at port" className="w-56" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Adding…" : "Add cost"}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
