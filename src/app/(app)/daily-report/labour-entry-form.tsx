"use client";

import { useActionState, useState } from "react";
import { updateSingleLabourEntryAction } from "./actions";
import { Select, Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  LABOUR_DEPARTMENTS,
  LABOUR_DEPARTMENT_LABEL,
  LABOUR_ROLE_MATRIX,
  LABOUR_ROLE_LABEL,
  isNameBasedRole,
} from "@/lib/labour";

export function LabourEntryForm({
  factoryId,
  date,
  shiftType,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
}) {
  const [department, setDepartment] = useState(LABOUR_DEPARTMENTS[0]);
  const availableRoles = LABOUR_ROLE_MATRIX[department];
  const [role, setRole] = useState(availableRoles[0]);

  const boundAction = updateSingleLabourEntryAction.bind(null, factoryId, date, shiftType);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="department" value={department} />
      <input type="hidden" name="role" value={role} />
      <FieldGroup label="Department">
        <Select
          value={department}
          onChange={(e) => {
            const nextDepartment = e.target.value as (typeof LABOUR_DEPARTMENTS)[number];
            setDepartment(nextDepartment);
            const nextRoles = LABOUR_ROLE_MATRIX[nextDepartment];
            if (!nextRoles.includes(role)) setRole(nextRoles[0]);
          }}
          className="w-44"
        >
          {LABOUR_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {LABOUR_DEPARTMENT_LABEL[d]}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="w-36">
          {availableRoles.map((r) => (
            <option key={r} value={r}>
              {LABOUR_ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label={isNameBasedRole(role) ? "Supervisor name" : "Headcount"}>
        {isNameBasedRole(role) ? (
          <Input key={`${department}-${role}`} name="value" placeholder="Name" className="w-32" />
        ) : (
          <Input key={`${department}-${role}`} name="value" type="number" min="0" className="w-20" />
        )}
      </FieldGroup>
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
