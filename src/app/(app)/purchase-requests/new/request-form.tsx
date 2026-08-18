"use client";

import { useActionState } from "react";
import { createPurchaseRequestAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

export function RequestForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createPurchaseRequestAction, undefined);
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={common.factory}>
          <Select name="factoryId" required defaultValue={factories[0]?.id ?? ""}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.colCategory}>
          <Select name="category" required defaultValue="CLEANING_MATERIALS">
            <option value="CLEANING_MATERIALS">{dict.categoryCleaningMaterials}</option>
            <option value="EQUIPMENT">{dict.categoryEquipment}</option>
            <option value="SPARE_PARTS">{dict.categorySpareParts}</option>
            <option value="OTHER">{common.other}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.colItem}>
          <Input name="itemDescription" required placeholder={dict.formItemPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.rowQuantity}>
          <Input name="quantity" placeholder={dict.formQuantityPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.formReason}>
          <Input name="reason" placeholder={dict.formReasonPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.formPhoto}>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="block w-full text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? common.submitting : dict.submitRequest}
        </Button>
      </Card>
    </form>
  );
}
