"use client";

import { useActionState, useRef } from "react";
import { addBannedItemScreeningAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

export function ScreeningForm({
  factories,
  knownSupervisorNames,
}: {
  factories: Pick<Factory, "id" | "name">[];
  knownSupervisorNames: string[];
}) {
  const [state, formAction, pending] = useActionState(addBannedItemScreeningAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations().personalItems;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <FieldGroup label={dict.screeningFormFactory}>
        <Select name="factoryId" defaultValue={factories[0]?.id ?? ""} required>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.screeningFormDate}>
        <Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label={dict.screeningFormPerson}>
        <Input name="personName" required placeholder={dict.screeningFormPersonPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.screeningFormItem}>
        <Input name="itemFound" required placeholder={dict.screeningFormItemPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.screeningFormDisposalMethod}>
        <Input name="disposalMethod" placeholder={dict.screeningFormDisposalMethodPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.screeningFormLocation}>
        <Input name="location" placeholder={dict.screeningFormLocationPlaceholder} />
      </FieldGroup>
      <FieldGroup label={dict.screeningFormSupervisor}>
        <Input name="supervisorName" list="screening-supervisors" required placeholder={dict.screeningFormSupervisorPlaceholder} />
        <datalist id="screening-supervisors">
          {knownSupervisorNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <div className="flex items-end">
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? dict.screeningFormSaving : dict.screeningFormSubmit}
        </Button>
      </div>
      {errorMessage && <p className="col-span-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
