"use client";

import { useActionState, useRef } from "react";
import { addSupervisorTrainingAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function SupervisorTrainingForm({ knownNames, knownTypes }: { knownNames: string[]; knownTypes: string[] }) {
  const [state, formAction, pending] = useActionState(addSupervisorTrainingAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-5"
    >
      <FieldGroup label="Supervisor">
        <Input name="supervisorName" list="supervisor-names" required />
        <datalist id="supervisor-names">
          {knownNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Training Type">
        <Input name="trainingType" list="supervisor-training-types" required />
        <datalist id="supervisor-training-types">
          {knownTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Trained Date">
        <Input name="trainedDate" type="date" required />
      </FieldGroup>
      <FieldGroup label="Expiry Date (if applicable)">
        <Input name="expiryDate" type="date" />
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" />
      </FieldGroup>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-5">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add Training Record"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
