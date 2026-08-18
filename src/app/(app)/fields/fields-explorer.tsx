"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";

function MapLoading() {
  const { fields: dict } = useTranslations();
  return <p className="py-8 text-center text-sm text-slate-400">{dict.loadingMap}</p>;
}

// Leaflet touches `window` at module load time, so it can't be part of the
// server-rendered pass even inside a client component tree.
const FieldsLeafletMap = dynamic(() => import("./fields-leaflet-map").then((m) => m.FieldsLeafletMap), {
  ssr: false,
  loading: MapLoading,
});

export type FieldRow = {
  id: string;
  name: string;
  farmName: string;
  station: string | null;
  valve: string | null;
  variety: string | null;
  areaFeddans: number | null;
  plantingDate: string | null;
  avgTonPerFeddan: number | null;
  googleMapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  boundaryLatLng: number[][][] | null;
};

export function FieldsExplorer({ fields }: { fields: FieldRow[] }) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { fields: dict } = useTranslations();

  const farmLabel = useMemo(() => {
    const names = new Set(fields.map((f) => f.farmName));
    return names.size === 1 ? [...names][0] : `${names.size} farms`;
  }, [fields]);

  const filteredFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.name.toLowerCase().includes(q) || (f.valve ?? "").toLowerCase().includes(q));
  }, [fields, query]);

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const totalArea = fields.reduce((s, f) => s + (f.areaFeddans ?? 0), 0);
  const hasGeometry = fields.some((f) => f.boundaryLatLng);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {dict.layoutTitle
                .replace("{farm}", farmLabel)
                .replace("{count}", String(fields.length))
                .replace("{area}", totalArea.toFixed(1))}
            </h2>
            <span className="text-xs text-slate-400">{dict.clickPlotHint}</span>
          </div>
          {hasGeometry ? (
            <FieldsLeafletMap fields={fields} selectedFieldId={selectedFieldId} onSelect={setSelectedFieldId} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">{dict.noGeometry}</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">{dict.fieldDetailsTitle}</h2>
          {selectedField ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label={dict.rowName} value={selectedField.name} />
              <Row label={dict.rowFarm} value={selectedField.farmName} />
              <Row label={dict.rowStation} value={selectedField.station} />
              <Row label={dict.rowValve} value={selectedField.valve} />
              <Row
                label={dict.rowArea}
                value={selectedField.areaFeddans ? `${selectedField.areaFeddans} ${dict.feddansSuffix}` : null}
              />
              <Row label={dict.rowPlantingDate} value={selectedField.plantingDate} />
              <Row
                label={dict.rowAvgYield}
                value={selectedField.avgTonPerFeddan ? `${selectedField.avgTonPerFeddan} ${dict.tonPerFeddanSuffix}` : null}
              />
              {selectedField.googleMapsUrl && (
                <div className="pt-2">
                  <a
                    href={selectedField.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    {dict.openInGoogleMaps}
                  </a>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">{dict.clickPlotOrRow}</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {dict.allPlotsTitle.replace("{count}", String(filteredFields.length))}
          </h2>
          <input
            type="text"
            placeholder={dict.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.rowName}</th>
              <th className="px-4 py-2 font-medium">{dict.colAreaFeddans}</th>
              <th className="px-4 py-2 font-medium">{dict.colPlantingDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colAvgTonFed}</th>
              <th className="px-4 py-2 font-medium">{dict.colMaps}</th>
            </tr>
          </thead>
          <tbody>
            {filteredFields.map((f) => (
              <tr
                key={f.id}
                onClick={() => setSelectedFieldId(f.id)}
                className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 ${
                  f.id === selectedFieldId ? "bg-amber-50" : ""
                }`}
              >
                <td className="px-4 py-2 font-medium text-slate-800">{f.name}</td>
                <td className="px-4 py-2">{f.areaFeddans ?? "—"}</td>
                <td className="px-4 py-2">{f.plantingDate ?? "—"}</td>
                <td className="px-4 py-2">{f.avgTonPerFeddan ?? "—"}</td>
                <td className="px-4 py-2">
                  {f.googleMapsUrl ? (
                    <a
                      href={f.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-emerald-700 hover:underline"
                    >
                      {dict.openLink}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filteredFields.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noPlotsMatch}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}
