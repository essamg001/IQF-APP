"use client";

import { useActionState, useRef } from "react";
import { addCertificationAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

export function CertificationForm() {
  const [state, formAction, pending] = useActionState(addCertificationAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const { certifications: dict, common } = useTranslations();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div className="col-span-2">
        <FieldGroup label={dict.formName}>
          <Input name="name" placeholder={dict.formNamePlaceholder} required />
        </FieldGroup>
      </div>
      <FieldGroup label={dict.formCertNumber}>
        <Input name="certNumber" />
      </FieldGroup>
      <FieldGroup label={dict.formValidTo}>
        <Input name="validTo" type="date" required />
      </FieldGroup>
      <div className="col-span-2 sm:col-span-4">
        <FieldGroup label={dict.formNotes}>
          <Input name="notes" />
        </FieldGroup>
      </div>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? common.saving : dict.addCertification}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
