"use client";

import { useActionState } from "react";
import { addClientSpecAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DEFECT_FIELDS } from "@/lib/validation/client";

export function AddSpecForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(addClientSpecAction.bind(null, clientId), undefined);
  const isSuccess = state === "ok";
  const errorMessage = state && !isSuccess ? state : undefined;

  return (
    <form action={formAction} key={isSuccess ? "reset" : "initial"} className="space-y-4">
      <FieldGroup label="Spec name (e.g. Whole 25-35mm, Sliced 6-8mm)">
        <Input name="specName" required placeholder="Standard" className="w-80" />
      </FieldGroup>

      <div className="grid grid-cols-3 gap-3">
        <FieldGroup label="Grade">
          <Select name="grade" defaultValue="A">
            <option value="A">Grade A</option>
            <option value="B">Grade B (class 2)</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Format">
          <Select name="format" defaultValue="WHOLE">
            <option value="WHOLE">Whole</option>
            <option value="SLICED">Sliced</option>
            <option value="DICED">Diced</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Size / caliber">
          <Input name="sizeCaliber" />
        </FieldGroup>
        <FieldGroup label="Brix">
          <Input name="brix" placeholder="e.g. 8-11%" />
        </FieldGroup>
        <FieldGroup label="pH">
          <Input name="ph" placeholder="e.g. 3.2-3.6" />
        </FieldGroup>
      </div>

      <p className="text-xs font-medium text-slate-500">
        Defect tolerances (free text — %, counts like &quot;3pcs/10kg&quot;, or &quot;*&quot; for n/a)
      </p>
      <div className="grid grid-cols-4 gap-3">
        {DEFECT_FIELDS.map((f) => (
          <FieldGroup key={f.key} label={f.label}>
            <Input name={f.key} placeholder="*" />
          </FieldGroup>
        ))}
      </div>

      <FieldGroup label="Notes">
        <Input name="notes" />
      </FieldGroup>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {isSuccess && <p className="text-sm font-medium text-emerald-700">Specification added.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add specification"}
      </Button>
    </form>
  );
}
