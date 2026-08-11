"use client";

import { useActionState, useRef } from "react";
import { addStaffTrainingAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export function StaffTrainingForm({
  knownNames,
  knownJobTitles,
  knownTypes,
  knownProviders,
  knownTrainers,
}: {
  knownNames: string[];
  knownJobTitles: string[];
  knownTypes: string[];
  knownProviders: string[];
  knownTrainers: string[];
}) {
  const [state, formAction, pending] = useActionState(addStaffTrainingAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <FieldGroup label="Tier">
        <Select name="tier" defaultValue="WORKER">
          <option value="SUPERVISOR">Supervisor / Management</option>
          <option value="WORKER">Worker</option>
        </Select>
      </FieldGroup>
      <FieldGroup label="Name">
        <Input name="attendeeName" list="staff-training-names" required />
        <datalist id="staff-training-names">
          {knownNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Job Title">
        <Input name="jobTitle" list="staff-training-job-titles" />
        <datalist id="staff-training-job-titles">
          {knownJobTitles.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Gender">
        <Select name="gender" defaultValue="">
          <option value="">—</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </Select>
      </FieldGroup>
      <FieldGroup label="Training Type">
        <Input name="trainingType" list="staff-training-types" required />
        <datalist id="staff-training-types">
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
      <FieldGroup label="Provider">
        <Input name="provider" list="staff-training-providers" />
        <datalist id="staff-training-providers">
          {knownProviders.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Trainer">
        <Input name="trainerName" list="staff-training-trainers" />
        <datalist id="staff-training-trainers">
          {knownTrainers.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Notes">
        <Input name="notes" />
      </FieldGroup>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add Training Record"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
