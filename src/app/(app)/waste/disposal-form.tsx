"use client";

import { useActionState, useRef } from "react";
import { addWasteDisposalAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

export function DisposalForm({
  factories,
  knownSupervisorNames,
  knownDisposalMethods,
}: {
  factories: Pick<Factory, "id" | "name">[];
  knownSupervisorNames: string[];
  knownDisposalMethods: string[];
}) {
  const [state, formAction, pending] = useActionState(addWasteDisposalAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().waste;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <FieldGroup label={dict.disposalFormFactory}>
        <Select name="factoryId" defaultValue={factories[0]?.id ?? ""} required>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.disposalFormDate}>
        <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label={dict.disposalFormSupervisor}>
        <Input name="supervisorName" list="waste-disposal-supervisors" required placeholder={dict.disposalFormSupervisorPlaceholder} />
        <datalist id="waste-disposal-supervisors">
          {knownSupervisorNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.disposalFormMethod}>
        <Input name="disposalMethod" list="waste-disposal-methods" required placeholder={dict.disposalFormMethodPlaceholder} />
        <datalist id="waste-disposal-methods">
          {knownDisposalMethods.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.disposalFormLocation}>
        <Input name="location" placeholder={dict.disposalFormLocationPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.disposalFormClassification}>
        <Select name="classification" defaultValue="OTHER">
          <option value="HAZARDOUS">{dict.classificationHazardous}</option>
          <option value="ORGANIC">{dict.classificationOrganic}</option>
          <option value="OTHER">{dict.classificationOther}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.disposalFormNotes}>
        <Input name="notes" />
      </FieldGroup>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? dict.disposalFormSaving : dict.disposalFormSubmit}
        </Button>
      </div>
      {errorMessage && <p className="col-span-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
