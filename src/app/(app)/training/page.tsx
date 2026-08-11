import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LABOUR_DEPARTMENT_LABEL } from "@/lib/labour";
import { trainingExpiryStatus, trainingExpiryColor } from "@/lib/training";
import { SupervisorTrainingForm } from "./supervisor-training-form";
import { DepartmentTrainingForm } from "./department-training-form";

const STATUS_LABEL: Record<string, string> = {
  NONE: "No expiry",
  OK: "Valid",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
};

export default async function TrainingPage() {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const now = new Date();

  const [supervisorRecords, departmentRecords, factories] = await Promise.all([
    prisma.supervisorTrainingRecord.findMany({ orderBy: { trainedDate: "desc" }, take: 200 }),
    prisma.departmentTrainingRecord.findMany({
      include: { factory: true },
      orderBy: { trainedDate: "desc" },
      take: 200,
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
  ]);

  const knownSupervisorNames = [...new Set(supervisorRecords.map((r) => r.supervisorName))].sort();
  const knownSupervisorTrainingTypes = [...new Set(supervisorRecords.map((r) => r.trainingType))].sort();
  const knownDepartmentTrainingTypes = [...new Set(departmentRecords.map((r) => r.trainingType))].sort();

  const flaggedSupervisorCount = supervisorRecords.filter((r) => {
    const status = trainingExpiryStatus(r.expiryDate, now);
    return status === "EXPIRED" || status === "EXPIRING_SOON";
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Staff Training</h1>
        <p className="mt-1 text-sm text-slate-500">
          Food-safety and role training records. Supervisors are tracked individually by name; daily workers have no
          individual record in the system, so their training is tracked as department-level coverage instead.
          Training types are free entry for now — a fixed list is coming.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Supervisor Training</h2>
          {flaggedSupervisorCount > 0 && <Badge color="red">{flaggedSupervisorCount} expired or expiring soon</Badge>}
        </div>
        <Card>
          <SupervisorTrainingForm knownNames={knownSupervisorNames} knownTypes={knownSupervisorTrainingTypes} />
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Supervisor</th>
                <th className="px-4 py-2 font-medium">Training</th>
                <th className="px-4 py-2 font-medium">Trained</th>
                <th className="px-4 py-2 font-medium">Expiry</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {supervisorRecords.map((r) => {
                const status = trainingExpiryStatus(r.expiryDate, now);
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{r.supervisorName}</td>
                    <td className="px-4 py-2">{r.trainingType}</td>
                    <td className="px-4 py-2">{format(r.trainedDate, "dd MMM yyyy")}</td>
                    <td className="px-4 py-2">{r.expiryDate ? format(r.expiryDate, "dd MMM yyyy") : "—"}</td>
                    <td className="px-4 py-2">
                      <Badge color={trainingExpiryColor(status)}>{STATUS_LABEL[status]}</Badge>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.notes ?? "—"}</td>
                  </tr>
                );
              })}
              {supervisorRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No supervisor training recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Department Training Coverage</h2>
        <Card>
          <DepartmentTrainingForm factories={factories} knownTypes={knownDepartmentTrainingTypes} />
        </Card>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Factory</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Training</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Coverage</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {departmentRecords.map((r) => {
                const pct = r.totalCount > 0 ? Math.round((r.trainedCount / r.totalCount) * 100) : null;
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{r.factory.name}</td>
                    <td className="px-4 py-2">{LABOUR_DEPARTMENT_LABEL[r.department]}</td>
                    <td className="px-4 py-2">{r.trainingType}</td>
                    <td className="px-4 py-2">{format(r.trainedDate, "dd MMM yyyy")}</td>
                    <td className="px-4 py-2">
                      {r.trainedCount}/{r.totalCount}
                      {pct != null && <span className="ml-1 text-slate-400">({pct}%)</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.notes ?? "—"}</td>
                  </tr>
                );
              })}
              {departmentRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No department training recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
