import { Card } from "@/components/ui/card";
import { LabourMatrixForm } from "./labour-matrix-form";

type Entry = { shiftType: string; department: string; role: string; headcount: number | null; supervisorName: string | null };

function totalHeadcount(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + (e.role === "SUPERVISOR" ? (e.supervisorName ? 1 : 0) : e.headcount ?? 0), 0);
}

export function LabourSection({
  factoryId,
  factoryName,
  date,
  entries,
}: {
  factoryId: string;
  factoryName: string;
  date: string;
  entries: Entry[];
}) {
  const dayEntries = entries.filter((e) => e.shiftType === "DAY");
  const nightEntries = entries.filter((e) => e.shiftType === "NIGHT");

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Labour Distribution</h3>
      <p className="mt-1 text-xs text-slate-500">
        Who&apos;s where in the factory this shift — supervisors by name, everyone else by headcount.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shift 1 (Day)</h4>
            <span className="text-xs text-slate-400">{totalHeadcount(dayEntries)} on shift</span>
          </div>
          <LabourMatrixForm factoryId={factoryId} date={date} shiftType="DAY" entries={dayEntries} />
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Shift 2 (Night)</h4>
            <span className="text-xs text-slate-400">{totalHeadcount(nightEntries)} on shift</span>
          </div>
          <LabourMatrixForm factoryId={factoryId} date={date} shiftType="NIGHT" entries={nightEntries} />
        </div>
      </div>
    </Card>
  );
}
