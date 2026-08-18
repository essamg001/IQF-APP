"use client";

import { useActionState } from "react";
import { createQualityIssueAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Client } from "@prisma/client";

const today = new Date().toISOString().slice(0, 10);

export function IssueForm({ clients }: { clients: Client[] }) {
  const [state, formAction, pending] = useActionState(createQualityIssueAction, undefined);
  const errorMessage = typeof state === "string" ? state : undefined;
  const fullDict = useTranslations();
  const dict = fullDict.qualityIssues;
  const claimsDict = fullDict.orders;

  return (
    <form action={formAction}>
      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={dict.dateLabel}>
            <Input name="issueDate" type="date" defaultValue={today} required />
          </FieldGroup>
          <FieldGroup label={dict.clientOptionalLabel}>
            <Select name="clientId" defaultValue="">
              <option value="">{dict.noneInternalOption}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.reasonLabel}>
            <Select name="reason" required defaultValue="QUALITY">
              <option value="QUALITY">{claimsDict.claimReasonQuality}</option>
              <option value="PACKAGING">{claimsDict.claimReasonPackaging}</option>
              <option value="FOREIGN_MATERIAL">{claimsDict.claimReasonForeignMaterial}</option>
              <option value="TRANSPORT">{claimsDict.claimReasonTransport}</option>
            </Select>
          </FieldGroup>
          <FieldGroup label={dict.varietyLabel}>
            <Input name="variety" />
          </FieldGroup>
          <FieldGroup label={dict.referenceLabel}>
            <Input name="relatedReference" placeholder={dict.referencePlaceholder} />
          </FieldGroup>
        </div>

        <FieldGroup label={dict.whatHappenedLabel}>
          <Input name="issueDetails" placeholder={dict.whatHappenedPlaceholder} />
        </FieldGroup>

        <FieldGroup label={dict.correctiveActionOptionalLabel}>
          <Input name="correctiveAction" placeholder={dict.correctiveActionPlaceholder} />
        </FieldGroup>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? dict.saving : dict.reportIssue}
        </Button>
      </Card>
    </form>
  );
}
