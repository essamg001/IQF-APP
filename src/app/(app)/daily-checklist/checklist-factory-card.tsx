import { Card } from "@/components/ui/card";
import { DAILY_CHECKLIST_SECTIONS, totalDailyChecklistItemCount } from "@/lib/dailyChecklist";
import { ChecklistItemToggle } from "./checklist-item-toggle";

type Confirmation = { itemKey: string; confirmedByName: string };

export function ChecklistFactoryCard({
  factoryId,
  factoryName,
  date,
  shiftType,
  confirmations,
  canEdit,
}: {
  factoryId: string;
  factoryName: string;
  date: string;
  shiftType: "DAY" | "NIGHT";
  confirmations: Confirmation[];
  canEdit: boolean;
}) {
  const confirmedByKey = new Map(confirmations.map((c) => [c.itemKey, c.confirmedByName]));
  const total = totalDailyChecklistItemCount();
  const done = confirmations.length;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Daily Checklist</h3>
        <span className="text-xs text-slate-500">
          {done}/{total} completed
        </span>
      </div>
      {!canEdit && (
        <p className="mt-1 text-xs text-slate-400">Only the Owner or Head of Production can check off items.</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        {DAILY_CHECKLIST_SECTIONS.map((section) => (
          <div key={section.key} className="rounded-md border border-slate-200 p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-red-600">
              {section.letter}. {section.label}
            </h4>
            <div className="mt-1 divide-y divide-slate-50">
              {section.items.map((item) => {
                const checked = confirmedByKey.has(item.key);
                return (
                  <ChecklistItemToggle
                    key={`${item.key}-${checked}`}
                    factoryId={factoryId}
                    date={date}
                    shiftType={shiftType}
                    itemKey={item.key}
                    text={item.text}
                    checked={checked}
                    confirmedByName={confirmedByKey.get(item.key) ?? null}
                    disabled={!canEdit}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
