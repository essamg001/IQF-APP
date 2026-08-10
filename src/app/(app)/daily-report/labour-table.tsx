import { LABOUR_DEPARTMENTS, LABOUR_DEPARTMENT_LABEL, LABOUR_ROLE_MATRIX } from "@/lib/labour";

type Entry = { department: string; role: string; headcount: number | null; supervisorName: string | null };

export function LabourTable({ entries }: { entries: Entry[] }) {
  const cellValue = (department: string, role: string) => {
    const entry = entries.find((e) => e.department === department && e.role === role);
    if (!entry) return "—";
    return role === "SUPERVISOR" ? entry.supervisorName ?? "—" : entry.headcount?.toString() ?? "—";
  };

  return (
    <table className="w-full text-left text-xs">
      <thead className="border-b border-slate-200 text-slate-500">
        <tr>
          <th className="py-1.5 pr-3 font-medium">Department</th>
          <th className="py-1.5 pr-3 font-medium">Supervisor</th>
          <th className="py-1.5 pr-3 font-medium">Forklift</th>
          <th className="py-1.5 pr-3 font-medium">Daily Workers</th>
        </tr>
      </thead>
      <tbody>
        {LABOUR_DEPARTMENTS.map((department) => {
          const roles = LABOUR_ROLE_MATRIX[department];
          return (
            <tr key={department} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pr-3 font-medium text-slate-800">{LABOUR_DEPARTMENT_LABEL[department]}</td>
              <td className="py-1.5 pr-3 text-slate-700">
                {roles.includes("SUPERVISOR") ? cellValue(department, "SUPERVISOR") : <span className="text-slate-300">n/a</span>}
              </td>
              <td className="py-1.5 pr-3 text-slate-700">
                {roles.includes("FORKLIFT_DRIVER") ? cellValue(department, "FORKLIFT_DRIVER") : <span className="text-slate-300">n/a</span>}
              </td>
              <td className="py-1.5 pr-3 text-slate-700">
                {roles.includes("DAILY_WORKER") ? cellValue(department, "DAILY_WORKER") : <span className="text-slate-300">n/a</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
