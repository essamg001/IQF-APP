"use client";

import { useActionState, useState } from "react";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFECT_FIELDS, type SpecInput } from "@/lib/validation/client";

export type ClientInitial = {
  name: string;
  country?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  paymentTerms?: string | null;
  incoterms?: string | null;
  currency?: string;
  specs?: SpecInput[];
};

const EMPTY_SPEC: SpecInput = {
  specName: "",
  grade: "A",
  format: "WHOLE",
};

function SpecCard({
  spec,
  onChange,
  onRemove,
}: {
  spec: SpecInput;
  onChange: (next: SpecInput) => void;
  onRemove: () => void;
}) {
  const set = (key: keyof SpecInput, value: string) => onChange({ ...spec, [key]: value });

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <FieldGroup label="Spec name (e.g. Whole 25-35mm, Sliced 6-8mm)">
          <Input
            value={spec.specName}
            onChange={(e) => set("specName", e.target.value)}
            placeholder="Standard"
            className="w-80"
          />
        </FieldGroup>
        <button type="button" onClick={onRemove} className="ml-4 text-xs text-red-600 hover:underline">
          Remove
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <FieldGroup label="Grade">
          <Select value={spec.grade} onChange={(e) => set("grade", e.target.value)}>
            <option value="A">Grade A</option>
            <option value="B">Grade B (class 2)</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Format">
          <Select value={spec.format} onChange={(e) => set("format", e.target.value)}>
            <option value="WHOLE">Whole</option>
            <option value="SLICED">Sliced</option>
            <option value="DICED">Diced</option>
          </Select>
        </FieldGroup>
        <FieldGroup label="Size / caliber">
          <Input value={spec.sizeCaliber ?? ""} onChange={(e) => set("sizeCaliber", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="Brix">
          <Input value={spec.brix ?? ""} onChange={(e) => set("brix", e.target.value)} placeholder="e.g. 8-11%" />
        </FieldGroup>
        <FieldGroup label="pH">
          <Input value={spec.ph ?? ""} onChange={(e) => set("ph", e.target.value)} placeholder="e.g. 3.2-3.6" />
        </FieldGroup>
        <FieldGroup label="Max Total Plate Count (cfu/g)">
          <Input
            type="number"
            step="1"
            min="0"
            value={spec.maxCfuPerGram ?? ""}
            onChange={(e) => onChange({ ...spec, maxCfuPerGram: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder="e.g. 10000"
          />
        </FieldGroup>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">
        Defect tolerances (free text — %, counts like &quot;3pcs/10kg&quot;, or &quot;*&quot; for n/a)
      </p>
      <div className="mt-2 grid grid-cols-4 gap-3">
        {DEFECT_FIELDS.map((f) => (
          <FieldGroup key={f.key} label={f.label}>
            <Input
              value={spec[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder="*"
            />
          </FieldGroup>
        ))}
      </div>

      <div className="mt-3">
        <FieldGroup label="Notes">
          <Input value={spec.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </FieldGroup>
      </div>
    </div>
  );
}

export function ClientForm({
  action,
  initial,
  submitLabel,
}: {
  action: (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;
  initial?: ClientInitial;
  submitLabel: string;
}) {
  const [error, formAction, pending] = useActionState(action, undefined);
  const [specs, setSpecs] = useState<SpecInput[]>(initial?.specs ?? []);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Client details</h2>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Name">
            <Input name="name" required defaultValue={initial?.name} />
          </FieldGroup>
          <FieldGroup label="Country">
            <Input name="country" defaultValue={initial?.country ?? ""} />
          </FieldGroup>
          <FieldGroup label="Contact name">
            <Input name="contactName" defaultValue={initial?.contactName ?? ""} />
          </FieldGroup>
          <FieldGroup label="Contact email">
            <Input name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ""} />
          </FieldGroup>
          <FieldGroup label="Contact phone">
            <Input name="contactPhone" defaultValue={initial?.contactPhone ?? ""} />
          </FieldGroup>
          <FieldGroup label="Currency">
            <Input name="currency" defaultValue={initial?.currency ?? "USD"} />
          </FieldGroup>
          <FieldGroup label="Payment terms">
            <Input name="paymentTerms" placeholder="e.g. Net 30" defaultValue={initial?.paymentTerms ?? ""} />
          </FieldGroup>
          <FieldGroup label="Incoterms">
            <Input name="incoterms" placeholder="e.g. CIF, FOB" defaultValue={initial?.incoterms ?? ""} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Specifications</h2>
            <p className="text-xs text-slate-500">One spec per product form — a client can have any number.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setSpecs([...specs, { ...EMPTY_SPEC }])}>
            Add spec
          </Button>
        </div>

        <div className="space-y-4">
          {specs.map((spec, i) => (
            <SpecCard
              key={i}
              spec={spec}
              onChange={(next) => setSpecs(specs.map((s, j) => (j === i ? next : s)))}
              onRemove={() => setSpecs(specs.filter((_, j) => j !== i))}
            />
          ))}
          {specs.length === 0 && <p className="text-sm text-slate-400">No specs added yet.</p>}
        </div>
      </Card>

      <input type="hidden" name="specsJson" value={JSON.stringify(specs)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
