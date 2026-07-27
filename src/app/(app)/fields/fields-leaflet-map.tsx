"use client";

import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { latLngBounds, type LatLngTuple } from "leaflet";

function findCenter(fields: MapField[]): LatLngTuple {
  for (const f of fields) {
    if (f.boundaryLatLng?.[0]?.[0]) {
      const [lat, lng] = f.boundaryLatLng[0][0];
      return [lat, lng];
    }
  }
  return [31.0, 31.0];
}

const FILL = "#2a78d6"; // dataviz categorical slot 1 (blue) -- single-hue, identity is by geometry, not color
const FILL_SELECTED = "#eb6834"; // slot 2 (orange) -- two-state selected/default only, safe pair

export type MapField = {
  id: string;
  name: string;
  areaFeddans: number | null;
  boundaryLatLng: number[][][] | null;
};

function FitToFields({ fields }: { fields: MapField[] }) {
  const map = useMap();

  useEffect(() => {
    const points: LatLngTuple[] = [];
    for (const f of fields) {
      if (!f.boundaryLatLng) continue;
      for (const ring of f.boundaryLatLng) {
        for (const [lat, lng] of ring) points.push([lat, lng]);
      }
    }
    if (points.length === 0) return;
    map.fitBounds(latLngBounds(points), { padding: [20, 20] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  return null;
}

export function FieldsLeafletMap({
  fields,
  selectedFieldId,
  onSelect,
}: {
  fields: MapField[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
}) {
  const center = findCenter(fields);

  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom className="h-[500px] w-full rounded border border-slate-100">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToFields fields={fields} />
      {fields.map((f) => {
        if (!f.boundaryLatLng) return null;
        const isSelected = f.id === selectedFieldId;
        return (
          <Polygon
            key={f.id}
            positions={f.boundaryLatLng as LatLngTuple[][]}
            pathOptions={{
              color: isSelected ? FILL_SELECTED : FILL,
              fillColor: isSelected ? FILL_SELECTED : FILL,
              fillOpacity: isSelected ? 0.55 : 0.35,
              weight: isSelected ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(f.id) }}
          />
        );
      })}
    </MapContainer>
  );
}
