import { LABOUR_DEPARTMENTS, LABOUR_ROLE_MATRIX } from "@/lib/labour";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { LabourDepartment } from "@prisma/client";

type Entry = { department: string; role: string; headcount: number | null; supervisorName: string | null };

export async function LabourTable({ entries }: { entries: Entry[] }) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.dailyReport;
  const departmentLabel: Record<LabourDepartment, string> = {
    INTAKE: dict.deptIntake,
    INFEED: dict.deptInfeed,
    PROCESSING: dict.deptProcessing,
    OPERATIONS_EFFICIENCY: dict.deptOperationsEfficiency,
    QUALITY_CONTROL: dict.deptQualityControl,
    MAINTENANCE_ENGINEERING: dict.deptMaintenanceEngineering,
    PACKAGING: dict.deptPackaging,
    LOAD_OUT: dict.deptLoadOut,
    CLEANING: dict.deptCleaning,
  };

  const cellValue = (department: string, role: string) => {
    const entry = entries.find((e) => e.department === department && e.role === role);
    if (!entry) return "—";
    return role === "SUPERVISOR" ? entry.supervisorName ?? "—" : entry.headcount?.toString() ?? "—";
  };

  return (
    <table className="w-full text-start text-xs">
      <thead className="border-b border-slate-200 text-slate-500">
        <tr>
          <th className="py-1.5 pe-3 font-medium">{dict.colDepartment}</th>
          <th className="py-1.5 pe-3 font-medium">{dict.colSupervisor}</th>
          <th className="py-1.5 pe-3 font-medium">{dict.colForklift}</th>
          <th className="py-1.5 pe-3 font-medium">{dict.colDailyWorkers}</th>
        </tr>
      </thead>
      <tbody>
        {LABOUR_DEPARTMENTS.map((department) => {
          const roles = LABOUR_ROLE_MATRIX[department];
          return (
            <tr key={department} className="border-b border-slate-100 last:border-0">
              <td className="py-1.5 pe-3 font-medium text-slate-800">{departmentLabel[department]}</td>
              <td className="py-1.5 pe-3 text-slate-700">
                {roles.includes("SUPERVISOR") ? cellValue(department, "SUPERVISOR") : <span className="text-slate-300">{dict.notApplicable}</span>}
              </td>
              <td className="py-1.5 pe-3 text-slate-700">
                {roles.includes("FORKLIFT_DRIVER") ? cellValue(department, "FORKLIFT_DRIVER") : <span className="text-slate-300">{dict.notApplicable}</span>}
              </td>
              <td className="py-1.5 pe-3 text-slate-700">
                {roles.includes("DAILY_WORKER") ? cellValue(department, "DAILY_WORKER") : <span className="text-slate-300">{dict.notApplicable}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
