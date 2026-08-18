import { Card } from "@/components/ui/card";
import { LabourTable } from "./labour-table";
import { LabourEntryForm } from "./labour-entry-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

type Entry = { shiftType: string; department: string; role: string; headcount: number | null; supervisorName: string | null };

function totalHeadcount(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + (e.role === "SUPERVISOR" ? (e.supervisorName ? 1 : 0) : e.headcount ?? 0), 0);
}

export async function LabourSection({
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
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.dailyReport;
  const dayEntries = entries.filter((e) => e.shiftType === "DAY");
  const nightEntries = entries.filter((e) => e.shiftType === "NIGHT");

  return (
    <Card>
      <h3 className="text-sm font-semibold text-slate-900">
        {dict.labourSectionTitle.replace("{factory}", factoryName)}
      </h3>
      <p className="mt-1 text-xs text-slate-500">{dict.labourSectionDescription}</p>
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.shift1Day}</h4>
            <span className="text-xs text-slate-400">{dict.onShiftSuffix.replace("{count}", String(totalHeadcount(dayEntries)))}</span>
          </div>
          <LabourTable entries={dayEntries} />
          <LabourEntryForm factoryId={factoryId} date={date} shiftType="DAY" entries={dayEntries} />
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dict.shift2Night}</h4>
            <span className="text-xs text-slate-400">{dict.onShiftSuffix.replace("{count}", String(totalHeadcount(nightEntries)))}</span>
          </div>
          <LabourTable entries={nightEntries} />
          <LabourEntryForm factoryId={factoryId} date={date} shiftType="NIGHT" entries={nightEntries} />
        </div>
      </div>
    </Card>
  );
}
