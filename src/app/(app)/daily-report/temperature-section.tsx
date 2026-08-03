import { Card } from "@/components/ui/card";
import { LogTemperatureForm } from "./log-temperature-form";
import { getTemperatureLocations } from "@/lib/dailyReportLocations";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function formatHour(h: number) {
  const period = h < 12 || h === 24 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:00 ${period}`;
}

export function TemperatureSection({
  factoryId,
  factoryName,
  factoryCode,
  logs,
}: {
  factoryId: string;
  factoryName: string;
  factoryCode: string | null;
  logs: { location: string; recordedAt: Date; valueC: number }[];
}) {
  const locations = getTemperatureLocations(factoryCode);

  // Latest reading wins per location/hour bucket, in case of a re-entry.
  const valueByLocationHour = new Map<string, number>();
  for (const log of logs) {
    const hour = log.recordedAt.getHours();
    valueByLocationHour.set(`${log.location}__${hour}`, log.valueC);
  }

  return (
    <Card className="overflow-x-auto">
      <h3 className="text-sm font-semibold text-slate-900">{factoryName} — Temperature Log</h3>
      <div className="mt-3">
        <LogTemperatureForm factoryId={factoryId} locations={locations} />
      </div>

      <table className="mt-4 w-full text-left text-xs">
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2 font-medium">Location</th>
            <th className="px-2 py-2 font-medium">Limits</th>
            <th className="px-2 py-2 font-medium">Instrument</th>
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
              {HOURS.map((h) => (
                <td key={h} className="px-2 py-1.5 text-slate-700">
                  {valueByLocationHour.get(`${loc.name}__${h}`) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
