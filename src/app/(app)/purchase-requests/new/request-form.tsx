"use client";

import { useActionState } from "react";
import { createPurchaseRequestAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Factory } from "@prisma/client";

export function RequestForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createPurchaseRequestAction, undefined);

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
        <FieldGroup label="Category">
          <Select name="category" required defaultValue="CLEANING_MATERIALS">
            <option value="CLEANING_MATERIALS">Cleaning Materials</option>
            <option value="EQUIPMENT">Equipment</option>
            <option value="SPARE_PARTS">Spare Parts</option>
            <option value="OTHER">Other</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Item">
          <Input name="itemDescription" required placeholder="e.g. Novaclean Soap 1% — 20L drums" />
        </FieldGroup>
        <FieldGroup label="Quantity">
          <Input name="quantity" placeholder="e.g. 10 drums, or 1 unit" />
        </FieldGroup>
        <FieldGroup label="Reason / notes (optional)">
          <Input name="reason" placeholder="Why it's needed, urgency, etc." />
        </FieldGroup>
        <FieldGroup label="Photo (optional, JPEG, PNG, or PDF)">
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Submitting…" : "Submit Request"}
        </Button>
      </Card>
    </form>
  );
}
