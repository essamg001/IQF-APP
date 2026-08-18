import { Card } from "@/components/ui/card";
import {
  DAILY_CHECKLIST_SECTIONS,
  DAILY_CHECKLIST_SECTION_LABOUR_DEPARTMENT,
  totalDailyChecklistItemCount,
} from "@/lib/dailyChecklist";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { ChecklistSectionForm } from "./checklist-section-form";

type Score = { itemKey: string; score: number };
type SupervisorEntry = { department: string; supervisorName: string | null };

export function ChecklistFactoryCard({
  factoryId,
  factoryName,
  date,
  shiftType,
  scores,
  supervisorsByDepartment,
  canEdit,
  dict,
}: {
  factoryId: string;
  factoryName: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  scores: Score[];
  supervisorsByDepartment: SupervisorEntry[];
  canEdit: boolean;
  dict: Dictionary["dailyChecklist"];
}) {
  const total = totalDailyChecklistItemCount();
  const scoredCount = scores.length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{dict.factoryCardTitle.replace("{factory}", factoryName)}</h3>
        <span className="text-xs text-slate-500">
          {scoredCount}/{total} {dict.scoredSuffix}
        </span>
      </div>
      {!canEdit && <p className="mt-1 text-xs text-slate-400">{dict.onlyProduction}</p>}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {DAILY_CHECKLIST_SECTIONS.map((section) => {
          const sectionScores = scores.filter((s) => section.items.some((i) => i.key === s.itemKey));
          const department = DAILY_CHECKLIST_SECTION_LABOUR_DEPARTMENT[section.key];
          const supervisorName = department
            ? supervisorsByDepartment.find((e) => e.department === department)?.supervisorName
            : null;
          return (
            <div key={section.key} className="rounded-md border border-slate-200 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600">
                {section.letter}. {section.label}
                {supervisorName && <span className="ms-1 font-normal normal-case text-slate-500">({supervisorName})</span>}
              </h4>
              <div className="mt-1">
                <ChecklistSectionForm
                  key={JSON.stringify(sectionScores)}
                  factoryId={factoryId}
                  date={date}
                  shiftType={shiftType}
                  sectionKey={section.key}
                  items={section.items}
                  scores={sectionScores}
                  canEdit={canEdit}
                  dict={dict}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
