"use client";

import { useActionState, useRef } from "react";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { addToolInventoryItemAction } from "./actions";
import { useTranslations } from "@/lib/i18n/locale-context";

export function ItemForm() {
  const [state, formAction, pending] = useActionState(addToolInventoryItemAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.toolInventory;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="mt-3 grid grid-cols-3 gap-3"
    >
      <FieldGroup label={t.toolNameLabel}>
        <Input name="name" required placeholder={t.toolNamePlaceholder} />
      </FieldGroup>
      <FieldGroup label={t.countLabel}>
        <Input name="count" type="number" min="1" required />
      </FieldGroup>
      <FieldGroup label={dict.common.location}>
        <Input name="location" />
      </FieldGroup>
      <div className="col-span-3 flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? dict.common.saving : t.addTool}
        </Button>
        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
