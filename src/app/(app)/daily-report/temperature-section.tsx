import { Card } from "@/components/ui/card";
import { LogTemperatureForm } from "./log-temperature-form";
import { getTemperatureLocations, isTemperatureOutOfLimit } from "@/lib/dailyReportLocations";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function formatHour(h: number) {
  const period = h < 12 || h === 24 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

export async function TemperatureSection({
  factoryId,
  factoryName,
  factoryCode,
  logs,
}: {
  factoryId: string;
  factoryName: string;
  factoryCode: string | null;
  logs: { location: string; recordedAt: Date; valueC: number; checkedByName: string | null }[];
}) {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.dailyReport;
  const locations = getTemperatureLocations(factoryCode);

  // Latest reading wins per location/hour bucket, in case of a re-entry.
  const valueByLocationHour = new Map<string, number>();
  const checkedByLocationHour = new Map<string, string>();
  for (const log of logs) {
    const hour = log.recordedAt.getHours();
    valueByLocationHour.set(`${log.location}__${hour}`, log.valueC);
    if (log.checkedByName) checkedByLocationHour.set(`${log.location}__${hour}`, log.checkedByName);
  }

  return (
    <Card className="overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-900">
        {dict.temperatureSectionTitle.replace("{factory}", factoryName)}
      </h3>
      <div className="mt-3">
        <LogTemperatureForm factoryId={factoryId} factoryCode={factoryCode} locations={locations} />
      </div>

      <table className="mt-4 w-full text-start text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">{fullDict.common.location}</th>
            <th className="px-2 py-2 font-medium">{dict.colLimits}</th>
            <th className="px-2 py-2 font-medium">{dict.colInstrument}</th>
            {HOURS.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {formatHour(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {locations.map((loc) => (
            <tr key={loc.name} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-2 py-1.5 font-medium text-slate-800">{loc.name}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{loc.limits}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{loc.instrument}</td>
              {HOURS.map((h) => {
                const key = `${loc.name}__${h}`;
                const value = valueByLocationHour.get(key);
                const checkedBy = checkedByLocationHour.get(key);
                const outOfLimit = value != null && isTemperatureOutOfLimit(value, loc.limits);
                return (
                  <td
                    key={h}
                    title={checkedBy ? dict.checkedByLabel + ": " + checkedBy : undefined}
                    className={cn("px-2 py-1.5", outOfLimit ? "font-semibold text-red-600" : "text-slate-700")}
                  >
                    {value ?? "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
