"use client";

import { useActionState } from "react";
import { addProtocolAcknowledgmentAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { SupervisorProtocolRole } from "@prisma/client";

const today = new Date().toISOString().slice(0, 10);

export function AckForm({
  role,
  knownNames,
  knownJobTitles,
}: {
  role: SupervisorProtocolRole;
  knownNames: string[];
  knownJobTitles: string[];
}) {
  const [state, formAction, pending] = useActionState(addProtocolAcknowledgmentAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.supervisorRoles;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="role" value={role} />
      <FieldGroup label={t.ackFormName}>
        <Input name="attendeeName" required list="ack-names" className="w-48" />
        <datalist id="ack-names">
          {knownNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={t.ackFormJobTitle}>
        <Input name="jobTitle" list="ack-job-titles" className="w-40" />
        <datalist id="ack-job-titles">
          {knownJobTitles.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={t.ackFormDate}>
        <Input name="acknowledgedDate" type="date" defaultValue={today} required className="w-36" />
      </FieldGroup>
      <FieldGroup label={t.ackFormNotes}>
        <Input name="notes" className="w-48" />
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? t.saving : t.ackAddRecord}
      </Button>
      {errorMessage && <p className="w-full text-sm text-red-600">{errorMessage}</p>}
    </form>
  );
}
