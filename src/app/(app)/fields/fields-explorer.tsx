"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  centroidX: number | null;
  centroidY: number | null;
  boundary: number[][][] | null;
};

const FILL = "#2a78d6"; // dataviz categorical slot 1 (blue) -- single-hue, identity is by geometry, not color
const FILL_SELECTED = "#eb6834"; // slot 2 (orange) -- two-state selected/default only, safe pair

export function FieldsExplorer({ fields }: { fields: FieldRow[] }) {
  const farms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of fields) counts.set(f.farmName, (counts.get(f.farmName) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [fields]);

  const [selectedFarm, setSelectedFarm] = useState(farms[0]?.[0] ?? "");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const farmFields = useMemo(() => fields.filter((f) => f.farmName === selectedFarm), [fields, selectedFarm]);

  const filteredFields = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return farmFields;
    return farmFields.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.variety ?? "").toLowerCase().includes(q) ||
        (f.valve ?? "").toLowerCase().includes(q)
    );
  }, [farmFields, query]);

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const totalArea = farmFields.reduce((s, f) => s + (f.areaFeddans ?? 0), 0);

  const bounds = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const f of farmFields) {
      if (!f.boundary) continue;
      for (const ring of f.boundary) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }, [farmFields]);

  const VIEW_W = 900;
  const VIEW_H = 700;
  const PAD = 0.04;

  function project(x: number, y: number): [number, number] {
    if (!bounds) return [0, 0];
    const w = bounds.maxX - bounds.minX || 1;
    const h = bounds.maxY - bounds.minY || 1;
    const scale = Math.min((VIEW_W * (1 - 2 * PAD)) / w, (VIEW_H * (1 - 2 * PAD)) / h);
    const offsetX = (VIEW_W - w * scale) / 2;
    const offsetY = (VIEW_H - h * scale) / 2;
    const px = offsetX + (x - bounds.minX) * scale;
    const py = offsetY + (bounds.maxY - y) * scale; // flip Y: northing increases upward, SVG y increases downward
    return [px, py];
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {farms.map(([farm, count]) => (
          <button
            key={farm}
            onClick={() => {
              setSelectedFarm(farm);
              setSelectedFieldId(null);
              setQuery("");
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              farm === selectedFarm ? "bg-emerald-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {farm} <span className="opacity-70">({count})</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedFarm} layout — {farmFields.length} plots, {totalArea.toFixed(1)} feddans
            </h2>
            <span className="text-xs text-slate-400">Click a plot for details</span>
          </div>
          {bounds ? (
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full rounded border border-slate-100 bg-slate-50">
              {farmFields.map((f) => {
                if (!f.boundary) return null;
                const isSelected = f.id === selectedFieldId;
                return (
                  <g key={f.id} onClick={() => setSelectedFieldId(f.id)} className="cursor-pointer">
                    {f.boundary.map((ring, i) => (
                      <polygon
                        key={i}
                        points={ring.map(([x, y]) => project(x, y).join(",")).join(" ")}
                        fill={isSelected ? FILL_SELECTED : FILL}
                        fillOpacity={isSelected ? 0.55 : 0.35}
                        stroke={isSelected ? FILL_SELECTED : FILL}
                        strokeWidth={isSelected ? 2 : 1}
                      >
                        <title>
                          {f.name}
                          {f.variety ? ` — ${f.variety}` : ""}
                          {f.areaFeddans ? ` — ${f.areaFeddans} feddans` : ""}
                        </title>
                      </polygon>
                    ))}
                  </g>
                );
              })}
            </svg>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No boundary geometry for this farm.</p>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">Field details</h2>
          {selectedField ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={selectedField.name} />
              <Row label="Farm" value={selectedField.farmName} />
              <Row label="Station" value={selectedField.station} />
              <Row label="Valve" value={selectedField.valve} />
              <Row label="Variety" value={selectedField.variety} />
              <Row label="Area" value={selectedField.areaFeddans ? `${selectedField.areaFeddans} feddans` : null} />
              <Row label="Planting date" value={selectedField.plantingDate} />
              <Row
                label="Avg yield"
                value={selectedField.avgTonPerFeddan ? `${selectedField.avgTonPerFeddan} ton/feddan` : null}
              />
              {selectedField.googleMapsUrl && (
                <div className="pt-2">
                  <a
                    href={selectedField.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    Open in Google Maps →
                  </a>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-400">Click a plot on the map, or a row in the table below.</p>
          )}
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            All plots — {selectedFarm} ({filteredFields.length})
          </h2>
          <input
            type="text"
            placeholder="Search name, variety, valve…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Variety</th>
              <th className="px-4 py-2 font-medium">Area (feddans)</th>
              <th className="px-4 py-2 font-medium">Planting Date</th>
              <th className="px-4 py-2 font-medium">Avg ton/fed</th>
              <th className="px-4 py-2 font-medium">Maps</th>
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
                <td className="px-4 py-2">
                  <Badge color="slate">{f.variety ?? "—"}</Badge>
                </td>
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
                      Open
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {filteredFields.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No plots match.
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
      <dd className="text-right font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}
