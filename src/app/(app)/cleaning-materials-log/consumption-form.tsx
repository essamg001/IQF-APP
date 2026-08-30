"use client";

import { useActionState, useRef } from "react";
import { addCleaningMaterialConsumptionAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

export function ConsumptionForm({
  factories,
  knownMaterialNames,
  knownRecordedByNames,
}: {
  factories: Pick<Factory, "id" | "name">[];
  knownMaterialNames: string[];
  knownRecordedByNames: string[];
}) {
  const [state, formAction, pending] = useActionState(addCleaningMaterialConsumptionAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().cleaningMaterialsLog;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <FieldGroup label={dict.formFactory}>
        <Select name="factoryId" defaultValue={factories[0]?.id ?? ""} required>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.formDate}>
        <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label={dict.formMaterial}>
        <Input name="materialName" list="cleaning-material-names" required placeholder={dict.formMaterialPlaceholder} />
        <datalist id="cleaning-material-names">
          {knownMaterialNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.formQuantity}>
        <Input name="quantityUsed" type="number" min="0" step="0.01" required />
      </FieldGroup>
      <FieldGroup label={dict.formUnit}>
        <Input name="unit" placeholder={dict.formUnitPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.formConcentration}>
        <Input name="concentration" placeholder={dict.formConcentrationPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.formPurpose}>
        <Input name="purpose" placeholder={dict.formPurposePlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.formRecordedBy}>
        <Input name="recordedByName" list="cleaning-material-recorders" required placeholder={dict.formRecordedByPlaceholder} />
        <datalist id="cleaning-material-recorders">
          {knownRecordedByNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? dict.formSaving : dict.formSubmit}
        </Button>
      </div>
      {errorMessage && <p className="col-span-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
