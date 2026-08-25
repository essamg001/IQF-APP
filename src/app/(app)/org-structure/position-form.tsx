"use client";

import { useActionState } from "react";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { OrgPosition } from "@prisma/client";

type ActionFn = (prevState: string | undefined, formData: FormData) => Promise<string | undefined>;

export function PositionForm({
  position,
  positions,
  action,
}: {
  position?: OrgPosition;
  positions: OrgPosition[];
  action: ActionFn;
}) {
  const [error, formAction, pending] = useActionState(action, undefined);
  const dict = useTranslations().orgStructure;

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.titleLabel}>
            <Input name="title" required defaultValue={position?.title} />
          </FieldGroup>
          <FieldGroup label={dict.departmentLabel}>
            <Input name="department" defaultValue={position?.department ?? ""} />
          </FieldGroup>
          <FieldGroup label={dict.reportsToLabel}>
            <Select name="reportsToId" defaultValue={position?.reportsToId ?? ""}>
              <option value="">{dict.noneOption}</option>
              {positions
                .filter((p) => p.id !== position?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.headcountLabel}>
            <Input name="headcount" type="number" min="0" defaultValue={position?.headcount ?? 0} required />
          </FieldGroup>
          <FieldGroup label={dict.personNameLabel}>
            <Input name="personName" defaultValue={position?.personName ?? ""} placeholder={dict.vacantPlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.sortOrderLabel}>
            <Input name="sortOrder" type="number" defaultValue={position?.sortOrder ?? 0} />
          </FieldGroup>
        </div>
        <FieldGroup label={dict.notesLabel}>
          <Input name="notes" defaultValue={position?.notes ?? ""} />
        </FieldGroup>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? dict.saving : dict.savePosition}
        </Button>
      </Card>
    </form>
  );
}
