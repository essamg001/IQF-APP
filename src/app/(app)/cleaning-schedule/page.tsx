import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { addDays, formatDate, getWeekStart, parseLocalDateOnly, toDateOnlyString } from "@/lib/dates";
import { MASTER_CLEANING_SCHEDULE, MASTER_CLEANING_TASK_COUNT } from "@/lib/masterCleaningSchedule";
import { TaskDayCheckbox } from "./task-day-checkbox";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import {
  translateCleaningItem,
  translateCleaningTools,
  translateCleaningFrequency,
  translateCleaningZoneTitle,
} from "@/lib/i18n/cleaningTerms";

export default async function CleaningSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; factoryId?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");
  const locale = await resolveLocale();
  const dict = getDictionary(locale).cleaningSchedule;

  const { date: dateParam, factoryId: factoryIdParam } = await searchParams;
  const anchorDate = parseLocalDateOnly(dateParam ?? "") ?? new Date();
  const weekStart = getWeekStart(anchorDate);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = toDateOnlyString(weekStart);
  const prevWeekStr = toDateOnlyString(addDays(weekStart, -7));
  const nextWeekStr = toDateOnlyString(addDays(weekStart, 7));

  const factories = await prisma.factory.findMany({ orderBy: { code: "asc" } });
  const factoryId = factoryIdParam && factories.some((f) => f.id === factoryIdParam) ? factoryIdParam : factories[0]?.id;

  const logs = factoryId
    ? await prisma.masterCleaningTaskLog.findMany({
        where: { factoryId, date: { gte: weekStart, lt: addDays(weekStart, 7) }, completed: true },
      })
    : [];
  const completedSet = new Set(logs.map((l) => `${toDateOnlyString(l.date)}|${l.taskKey}`));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {dict.subtitle
            .replace("{taskCount}", String(MASTER_CLEANING_TASK_COUNT))
            .replace("{zoneCount}", String(MASTER_CLEANING_SCHEDULE.length))}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 border-b border-slate-200">
          {factories.map((f) => (
            <a
              key={f.id}
              href={`/cleaning-schedule?date=${weekStartStr}&factoryId=${f.id}`}
              className={cn(
                "rounded-t-md px-4 py-2 text-sm font-medium",
                f.id === factoryId
                  ? "border border-b-0 border-slate-200 bg-white text-emerald-700"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f.name}
              {f.code ? ` (${f.code})` : ""}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <a href={`/cleaning-schedule?date=${prevWeekStr}&factoryId=${factoryId ?? ""}`} className="rounded-md border border-slate-300 px-2.5 py-1.5 hover:bg-slate-50">
            {dict.prevWeek}
          </a>
          <span className="text-slate-600">
            {dict.weekOf
              .replace("{start}", formatDate(weekDates[0], "dd MMM", locale))
              .replace("{end}", formatDate(weekDates[6], "dd MMM yyyy", locale))}
          </span>
          <a href={`/cleaning-schedule?date=${nextWeekStr}&factoryId=${factoryId ?? ""}`} className="rounded-md border border-slate-300 px-2.5 py-1.5 hover:bg-slate-50">
            {dict.nextWeek}
          </a>
        </div>
      </div>

      {!factoryId && (
        <Card>
          <p className="text-sm text-slate-400">{dict.noFactoriesYet}</p>
        </Card>
      )}

      {factoryId &&
        MASTER_CLEANING_SCHEDULE.map((zone) => (
          <Card key={zone.key} className="overflow-x-auto">
            <h3 className="text-sm font-semibold text-slate-900">{translateCleaningZoneTitle(zone.title, locale)}</h3>
            <table className="mt-3 w-full text-start text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">{dict.colItem}</th>
                  <th className="py-1.5 pr-2 font-medium">{dict.colTools}</th>
                  <th className="py-1.5 pr-2 font-medium">{dict.colChemical}</th>
                  <th className="py-1.5 pr-2 font-medium whitespace-nowrap">{dict.colFrequency}</th>
                  {weekDates.map((d, i) => (
                    <th key={i} className="px-1.5 py-1.5 text-center font-medium">
                      {dict.weekDayLabels[i]}
                      <div className="text-[10px] font-normal text-slate-400">{d.getDate()}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zone.tasks.map((task) => (
                  <tr key={task.key} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 pr-2 font-medium text-slate-800">
                      {translateCleaningItem(task.item, locale)}
                    </td>
                    <td className="py-1.5 pr-2 text-slate-500">{translateCleaningTools(task.tools, locale)}</td>
                    <td className="py-1.5 pr-2 text-slate-500">{task.chemical ?? "—"}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap text-slate-500">
                      {translateCleaningFrequency(task.frequency, locale)}
                    </td>
                    {weekDates.map((d, i) => {
                      const dStr = toDateOnlyString(d);
                      return (
                        <td key={i} className="px-1.5 py-1.5 text-center">
                          <TaskDayCheckbox
                            factoryId={factoryId}
                            date={dStr}
                            taskKey={task.key}
                            defaultChecked={completedSet.has(`${dStr}|${task.key}`)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
    </div>
  );
}
