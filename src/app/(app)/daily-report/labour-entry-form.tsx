"use client";

import { useActionState, useState } from "react";
import { updateDepartmentLabourEntryAction } from "./actions";
import { Select, Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LABOUR_DEPARTMENTS, LABOUR_DEPARTMENT_LABEL, LABOUR_ROLE_MATRIX } from "@/lib/labour";

type Entry = { department: string; role: string; headcount: number | null; supervisorName: string | null };

export function LabourEntryForm({
  factoryId,
  date,
  shiftType,
  entries,
}: {
  factoryId: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  entries: Entry[];
}) {
  const [department, setDepartment] = useState(LABOUR_DEPARTMENTS[0]);
  const roles = LABOUR_ROLE_MATRIX[department];

  const boundAction = updateDepartmentLabourEntryAction.bind(null, factoryId, date, shiftType);
  const [state, formAction, pending] = useActionState(boundAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  const currentValue = (role: string) => {
    const entry = entries.find((e) => e.department === department && e.role === role);
    if (!entry) return "";
    return role === "SUPERVISOR" ? entry.supervisorName ?? "" : entry.headcount?.toString() ?? "";
  };

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="department" value={department} />
      <FieldGroup label="Area">
        <Select
          value={department}
          onChange={(e) => setDepartment(e.target.value as (typeof LABOUR_DEPARTMENTS)[number])}
          className="w-44"
        >
          {LABOUR_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {LABOUR_DEPARTMENT_LABEL[d]}
            </option>
          ))}
        </Select>
      </FieldGroup>
      {roles.includes("SUPERVISOR") && (
        <FieldGroup label="Supervisor name">
          <Input
            key={`${department}-sup`}
            name="supervisorName"
            defaultValue={currentValue("SUPERVISOR")}
            placeholder="Name"
            className="w-32"
          />
        </FieldGroup>
      )}
      {roles.includes("FORKLIFT_DRIVER") && (
        <FieldGroup label="Forklift Drivers">
          <Input
            key={`${department}-fork`}
            name="forkliftCount"
            type="number"
            min="0"
            defaultValue={currentValue("FORKLIFT_DRIVER")}
            className="w-20"
          />
        </FieldGroup>
      )}
      {roles.includes("DAILY_WORKER") && (
        <FieldGroup label="Daily Workers">
          <Input
            key={`${department}-daily`}
            name="dailyWorkerCount"
            type="number"
            min="0"
            defaultValue={currentValue("DAILY_WORKER")}
            className="w-20"
          />
        </FieldGroup>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {errorMessage && <p className="w-full text-xs text-red-600">{errorMessage}</p>}
    </form>
  );
}
