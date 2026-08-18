"use client";

import { useActionState } from "react";
import { createNonConformanceReportAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

const today = new Date().toISOString().slice(0, 10);

export function ReportForm({ factories }: { factories: Factory[] }) {
  const [state, formAction, pending] = useActionState(createNonConformanceReportAction, undefined);
  const errorMessage = typeof state === "string" ? state : undefined;
  const dict = useTranslations();
  const t = dict.nonConformance;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.common.date}>
            <Input name="date" type="date" defaultValue={today} required />
          </FieldGroup>
          <FieldGroup label={dict.common.factory}>
            <Select name="factoryId" required defaultValue={factories[0]?.id ?? ""}>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={t.ncTypeLabel}>
            <Select name="ncType" required defaultValue="PRODUCT">
              <option value="PRODUCT">{t.typeProduct}</option>
              <option value="PROCESS">{t.typeProcess}</option>
              <option value="EQUIPMENT">{t.typeEquipment}</option>
              <option value="DOCUMENTATION">{t.typeDocumentation}</option>
              <option value="SUPPLIER">{t.typeSupplier}</option>
              <option value="OTHER">{t.typeOther}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={t.sourceLabel}>
            <Select name="source" required defaultValue="STAFF_REPORT">
              <option value="STAFF_REPORT">{t.sourceStaffReport}</option>
              <option value="INTERNAL_AUDIT">{t.sourceInternalAudit}</option>
              <option value="EXTERNAL_AUDIT">{t.sourceExternalAudit}</option>
              <option value="CUSTOMER_COMPLAINT">{t.sourceCustomerComplaint}</option>
              <option value="INSPECTION">{t.sourceInspection}</option>
              <option value="OTHER">{t.sourceOther}</option>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup label={dict.common.location}>
          <Input name="location" required placeholder={t.locationPlaceholder} />
        </FieldGroup>
        <FieldGroup label={t.productReferenceLabel}>
          <Input name="productOrReference" placeholder={t.productReferencePlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.common.description}>
          <Input name="description" required placeholder={t.descriptionPlaceholder} />
        </FieldGroup>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? dict.common.saving : t.submit}
        </Button>
      </Card>
    </form>
  );
}
