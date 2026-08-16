"use client";

import { useActionState } from "react";
import { createStructuralIssueAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Factory } from "@prisma/client";

export function IssueForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createStructuralIssueAction, undefined);

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label="Factory">
          <Select name="factoryId" required defaultValue={factories[0]?.id ?? ""}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="Location">
          <Input name="location" required placeholder="e.g. Pre-Cooling floor, near door 2" />
        </FieldGroup>
        <FieldGroup label="Description">
          <Input name="description" required placeholder="What's damaged, and how badly" />
        </FieldGroup>
        <FieldGroup label="Photo of the damage (JPEG, PNG, or PDF)">
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Submitting…" : "Report Issue"}
        </Button>
      </Card>
    </form>
  );
}
