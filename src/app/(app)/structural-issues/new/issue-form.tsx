"use client";

import { useActionState } from "react";
import { createStructuralIssueAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

export function IssueForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createStructuralIssueAction, undefined);
  const dict = useTranslations();
  const t = dict.structuralIssues;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <FieldGroup label={dict.common.factory}>
          <Select name="factoryId" required defaultValue={factories[0]?.id ?? ""}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.common.location}>
          <Input name="location" required placeholder={t.formLocationPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.common.description}>
          <Input name="description" required placeholder={t.formDescriptionPlaceholder} />
        </FieldGroup>
        <FieldGroup label={t.formPhotoLabel}>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            required
            className="block w-full text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? dict.common.submitting : t.reportIssue}
        </Button>
      </Card>
    </form>
  );
}
