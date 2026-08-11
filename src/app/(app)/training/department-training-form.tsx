"use client";

import { useActionState, useRef } from "react";
import { addDepartmentTrainingAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LABOUR_DEPARTMENTS, LABOUR_DEPARTMENT_LABEL } from "@/lib/labour";
import type { LabourDepartment } from "@prisma/client";

export function DepartmentTrainingForm({
  factories,
  knownTypes,
}: {
  factories: { id: string; name: string }[];
  knownTypes: string[];
}) {
  const [state, formAction, pending] = useActionState(addDepartmentTrainingAction, undefined);
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
      <FieldGroup label="Factory">
        <Select name="factoryId" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {factories.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Department">
        <Select name="department" required defaultValue="">
          <option value="" disabled>
            Select…
          </option>
          {LABOUR_DEPARTMENTS.map((d: LabourDepartment) => (
            <option key={d} value={d}>
              {LABOUR_DEPARTMENT_LABEL[d]}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Training Type">
        <Input name="trainingType" list="department-training-types" required />
        <datalist id="department-training-types">
          {knownTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </FieldGroup>
      <FieldGroup label="Trained Date">
        <Input name="trainedDate" type="date" required />
      </FieldGroup>
      <FieldGroup label="Trained Count">
        <Input name="trainedCount" type="number" min={0} required />
      </FieldGroup>
      <FieldGroup label="Total Headcount">
        <Input name="totalCount" type="number" min={1} required />
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
