"use client";

import { useActionState, useRef } from "react";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function EquipmentForm({
  factoryId,
  action,
}: {
  factoryId: string;
  action: (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.forkliftCondition;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="mt-3 grid grid-cols-4 gap-3"
    >
      <input type="hidden" name="factoryId" value={factoryId} />
      <FieldGroup label={t.equipmentTypeLabel}>
        <Select name="equipmentType" defaultValue="DIESEL_CLARK">
          <option value="DIESEL_CLARK">{t.typeDiesel}</option>
          <option value="ELECTRIC_CLARK">{t.typeElectric}</option>
          <option value="POWER_PALLET">{t.typePowerPallet}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={t.equipmentNumberLabel}>
        <Input name="equipmentNumber" required />
      </FieldGroup>
      <FieldGroup label={t.glassPlasticCountLabel}>
        <Input name="glassPlasticPartsCount" type="number" min="0" />
      </FieldGroup>
      <FieldGroup label={t.glassPlasticDescLabel}>
        <Input name="glassPlasticPartsDescription" />
      </FieldGroup>
      <div className="col-span-4 flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? dict.common.saving : t.registerEquipment}
        </Button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
