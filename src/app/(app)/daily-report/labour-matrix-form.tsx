"use client";

import { useActionState } from "react";
import { updateLabourEntryAction } from "./actions";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LABOUR_DEPARTMENTS, LABOUR_DEPARTMENT_LABEL, LABOUR_ROLE_MATRIX, labourFieldName } from "@/lib/labour";

type Entry = { department: string; role: string; headcount: number | null; supervisorName: string | null };

export function LabourMatrixForm({
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
  const [state, formAction, pending] = useActionState(updateLabourEntryAction, undefined);
  const errorMessage = state && state !== "ok" ? state : undefined;

  const valueFor = (department: string, role: string) => {
    const entry = entries.find((e) => e.department === department && e.role === role);
    if (!entry) return "";
    return role === "SUPERVISOR" ? entry.supervisorName ?? "" : entry.headcount?.toString() ?? "";
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="factoryId" value={factoryId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="shiftType" value={shiftType} />
      <table className="w-full text-left text-xs">
        <thead className="text-slate-500">
          <tr>
            <th className="py-1 pr-2 font-medium">Department</th>
            <th className="py-1 pr-2 font-medium">Supervisor</th>
            <th className="py-1 pr-2 font-medium">Forklift</th>
            <th className="py-1 pr-2 font-medium">Daily Workers</th>
          </tr>
        </thead>
        <tbody>
          {LABOUR_DEPARTMENTS.map((department) => {
            const roles = LABOUR_ROLE_MATRIX[department];
            return (
              <tr key={department} className="border-t border-slate-100">
                <td className="py-1 pr-2 font-medium text-slate-700">{LABOUR_DEPARTMENT_LABEL[department]}</td>
                <td className="py-1 pr-2">
                  {roles.includes("SUPERVISOR") ? (
                    <Input
                      name={labourFieldName(department, "SUPERVISOR")}
                      defaultValue={valueFor(department, "SUPERVISOR")}
                      placeholder="Name"
                      className="w-28 text-xs"
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-1 pr-2">
                  {roles.includes("FORKLIFT_DRIVER") ? (
                    <Input
                      name={labourFieldName(department, "FORKLIFT_DRIVER")}
                      type="number"
                      min="0"
                      defaultValue={valueFor(department, "FORKLIFT_DRIVER")}
                      className="w-14 text-xs"
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="py-1 pr-2">
                  {roles.includes("DAILY_WORKER") ? (
                    <Input
                      name={labourFieldName(department, "DAILY_WORKER")}
                      type="number"
                      min="0"
                      defaultValue={valueFor(department, "DAILY_WORKER")}
                      className="w-14 text-xs"
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    </form>
  );
}
