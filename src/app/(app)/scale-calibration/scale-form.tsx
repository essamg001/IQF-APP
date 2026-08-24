"use client";

import { useActionState, useRef } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ScaleForm({
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
  const t = dict.scaleCalibration;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="mt-3 grid grid-cols-3 gap-3 md:grid-cols-6"
    >
      <input type="hidden" name="factoryId" value={factoryId} />
      <FieldGroup label={t.scaleNumberLabel}>
        <Input name="scaleNumber" required />
      </FieldGroup>
      <FieldGroup label={dict.common.location}>
        <Input name="location" />
      </FieldGroup>
      <FieldGroup label={t.targetWeightLabel}>
        <Input name="targetWeightKg" type="number" step="0.01" min="0" required />
      </FieldGroup>
      <FieldGroup label={t.sensitivityLabel}>
        <Input name="sensitivity" placeholder="30kg/2g" />
      </FieldGroup>
      <FieldGroup label={t.refValueLabel}>
        <Input name="refValueKg" type="number" step="0.01" min="0" />
      </FieldGroup>
      <FieldGroup label={t.maxErrorLabel}>
        <Input name="maxPermissibleErrorG" type="number" step="0.1" min="0" required placeholder="2" />
      </FieldGroup>
      <div className="col-span-3 flex items-center gap-3 md:col-span-6">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? dict.common.saving : t.registerScale}
        </Button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
