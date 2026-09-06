"use client";

import { useActionState, useRef } from "react";
import { addStaffTrainingAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";

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
  const { staffTraining: dict, common } = useTranslations();

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <FieldGroup label={dict.formTier}>
        <Select name="tier" defaultValue="WORKER">
          <option value="SUPERVISOR">{dict.optionSupervisor}</option>
          <option value="WORKER">{dict.optionWorker}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.formName}>
        <Input name="attendeeName" list="staff-training-names" required />
        <datalist id="staff-training-names">
          {knownNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.formJobTitle}>
        <Input name="jobTitle" list="staff-training-job-titles" />
        <datalist id="staff-training-job-titles">
          {knownJobTitles.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.formGender}>
        <Select name="gender" defaultValue="">
          <option value="">—</option>
          <option value="Male">{dict.genderMale}</option>
          <option value="Female">{dict.genderFemale}</option>
        </Select>
      </FieldGroup>
      <FieldGroup label={dict.formTrainingType}>
        <Input name="trainingType" list="staff-training-types" required />
        <datalist id="staff-training-types">
          {knownTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.formTrainedDate}>
        <Input name="trainedDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
      </FieldGroup>
      <FieldGroup label={dict.formExpiryDate}>
        <Input name="expiryDate" type="date" />
      </FieldGroup>
      <FieldGroup label={dict.formProvider}>
        <Input name="provider" list="staff-training-providers" />
        <datalist id="staff-training-providers">
          {knownProviders.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={dict.formTrainer}>
        <Input name="trainerName" list="staff-training-trainers" />
        <datalist id="staff-training-trainers">
          {knownTrainers.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label={common.notes}>
        <Input name="notes" />
      </FieldGroup>
      <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? common.saving : dict.addRecord}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
