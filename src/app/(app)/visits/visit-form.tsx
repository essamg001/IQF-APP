"use client";

import { useActionState } from "react";
import { createFactoryVisitAction } from "./actions";
import { Input, Select, FieldGroup, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

const today = new Date().toISOString().slice(0, 10);

export function VisitForm({
  factories,
  knownVisitorNames,
  knownOrganizations,
  knownPurposes,
}: {
  factories: Factory[];
  knownVisitorNames: string[];
  knownOrganizations: string[];
  knownPurposes: string[];
}) {
  const [state, formAction, pending] = useActionState(createFactoryVisitAction, undefined);
  const errorMessage = typeof state === "string" ? state : undefined;
  const dict = useTranslations();
  const t = dict.visits;

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
          <FieldGroup label={t.visitorNameLabel}>
            <Input name="visitorName" required list="visitor-names" />
            <datalist id="visitor-names">
              {knownVisitorNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label={t.organizationLabel}>
            <Input name="organization" list="visitor-orgs" />
            <datalist id="visitor-orgs">
              {knownOrganizations.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FieldGroup>
        </div>

        <FieldGroup label={t.purposeLabel}>
          <Input name="purpose" required list="visit-purposes" />
          <datalist id="visit-purposes">
            {knownPurposes.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </FieldGroup>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isAudit" /> {t.isAuditLabel}
        </label>

        <FieldGroup label={t.generalFeedbackLabel}>
          <Textarea name="generalFeedback" placeholder={t.generalFeedbackPlaceholder} />
        </FieldGroup>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? dict.common.saving : t.logVisit}
        </Button>
      </Card>
    </form>
  );
}
