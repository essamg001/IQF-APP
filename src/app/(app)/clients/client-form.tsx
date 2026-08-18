"use client";

import { useActionState, useState } from "react";
import { Input, Select, FieldGroup, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DEFECT_FIELDS, type SpecInput } from "@/lib/validation/client";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

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
  dict,
}: {
  spec: SpecInput;
  onChange: (next: SpecInput) => void;
  onRemove: () => void;
  dict: Dictionary["clients"];
}) {
  const set = (key: keyof SpecInput, value: string) => onChange({ ...spec, [key]: value });
  const DEFECT_LABEL: Record<string, string> = {
    overripe: dict.defectOverripe,
    unripe: dict.defectUnripe,
    calyx: dict.defectCalyx,
    leaves: dict.defectLeaves,
    stems: dict.defectStems,
    misshapen: dict.defectMisshapen,
    blemish: dict.defectBlemish,
    dryPump: dict.defectDryPump,
    clumps: dict.defectClumps,
    broken: dict.defectBroken,
    oxidation: dict.defectOxidation,
    mechanicalDamage: dict.defectMechanicalDamage,
    rotten: dict.defectRotten,
    insectDamage: dict.defectInsectDamage,
    internalQuality: dict.defectInternalQuality,
    deadWorm: dict.defectDeadWorm,
    fungalInfection: dict.defectFungalInfection,
    dryBruises: dict.defectDryBruises,
    foreignBodies: dict.defectForeignBodies,
  };

  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <FieldGroup label={dict.specNameLabel}>
          <Input
            value={spec.specName}
            onChange={(e) => set("specName", e.target.value)}
            placeholder={dict.specNamePlaceholder}
            className="w-80"
          />
        </FieldGroup>
        <button type="button" onClick={onRemove} className="ms-4 text-xs text-red-600 hover:underline">
          {dict.remove}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <FieldGroup label={dict.gradeFieldLabel}>
          <Select value={spec.grade} onChange={(e) => set("grade", e.target.value)}>
            <option value="A">{dict.gradeA}</option>
            <option value="B">{dict.gradeBClass2}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.formatLabel}>
          <Select value={spec.format} onChange={(e) => set("format", e.target.value)}>
            <option value="WHOLE">{dict.formatWhole}</option>
            <option value="SLICED">{dict.formatSliced}</option>
            <option value="DICED">{dict.formatDiced}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.sizeCaliberFieldLabel}>
          <Textarea rows={3} value={spec.sizeCaliber ?? ""} onChange={(e) => set("sizeCaliber", e.target.value)} />
        </FieldGroup>
        <FieldGroup label={dict.brixLabel}>
          <Input value={spec.brix ?? ""} onChange={(e) => set("brix", e.target.value)} placeholder={dict.brixPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.phLabel}>
          <Input value={spec.ph ?? ""} onChange={(e) => set("ph", e.target.value)} placeholder={dict.phPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.maxCfuLabel}>
          <Input
            type="number"
            step="1"
            min="0"
            value={spec.maxCfuPerGram ?? ""}
            onChange={(e) => onChange({ ...spec, maxCfuPerGram: e.target.value === "" ? undefined : Number(e.target.value) })}
            placeholder={dict.maxCfuPlaceholder}
          />
        </FieldGroup>
      </div>

      <p className="mt-4 text-xs font-medium text-slate-500">{dict.defectTolerancesHint}</p>
      <div className="mt-2 grid grid-cols-4 gap-3">
        {DEFECT_FIELDS.map((f) => (
          <FieldGroup key={f.key} label={DEFECT_LABEL[f.key]}>
            <Input
              value={spec[f.key] ?? ""}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder="*"
            />
          </FieldGroup>
        ))}
      </div>

      <div className="mt-3">
        <FieldGroup label={dict.notesFieldLabel}>
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
  const dict = useTranslations().clients;

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.clientDetailsTitle}</h2>
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label={dict.nameLabel}>
            <Input name="name" required defaultValue={initial?.name} />
          </FieldGroup>
          <FieldGroup label={dict.countryLabel}>
            <Input name="country" defaultValue={initial?.country ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.contactNameLabel}>
            <Input name="contactName" defaultValue={initial?.contactName ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.contactEmailLabel}>
            <Input name="contactEmail" type="email" defaultValue={initial?.contactEmail ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.contactPhoneLabel}>
            <Input name="contactPhone" defaultValue={initial?.contactPhone ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.currencyLabel}>
            <Input name="currency" defaultValue={initial?.currency ?? "USD"} />
          </FieldGroup>
          <FieldGroup label={dict.paymentTermsLabel}>
            <Input name="paymentTerms" placeholder={dict.paymentTermsPlaceholder} defaultValue={initial?.paymentTerms ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.incotermsLabel}>
            <Input name="incoterms" placeholder={dict.incotermsPlaceholder} defaultValue={initial?.incoterms ?? ""} />
          </FieldGroup>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{dict.specificationsFormTitle}</h2>
            <p className="text-xs text-slate-500">{dict.specificationsFormSubtitle}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setSpecs([...specs, { ...EMPTY_SPEC }])}>
            {dict.addSpec}
          </Button>
        </div>

        <div className="space-y-4">
          {specs.map((spec, i) => (
            <SpecCard
              key={i}
              spec={spec}
              dict={dict}
              onChange={(next) => setSpecs(specs.map((s, j) => (j === i ? next : s)))}
              onRemove={() => setSpecs(specs.filter((_, j) => j !== i))}
            />
          ))}
          {specs.length === 0 && <p className="text-sm text-slate-400">{dict.noSpecsAddedYet}</p>}
        </div>
      </Card>

      <input type="hidden" name="specsJson" value={JSON.stringify(specs)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? dict.saving : submitLabel}
      </Button>
    </form>
  );
}
