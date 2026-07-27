"use client";

import { MapContainer, TileLayer, Polygon, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
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

// The map sits in a CSS grid cell, so its container can still be mid-layout
// (near-zero width) at the very moment react-leaflet first mounts it. Any
// vector layer projected while that's true gets a degenerate path baked in,
// and Leaflet does not reliably re-derive it later just because the
// container was resized afterwards -- so the fix is to never construct the
// polygons until a ResizeObserver confirms the container has its real,
// final size.
function MapContents({
  fields,
  selectedFieldId,
  onSelect,
}: {
  fields: MapField[];
  selectedFieldId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  // The container's real size is unstable for a while after mount (it sits
  // in a CSS grid cell, and in some embedding contexts keeps getting resized
  // by the surrounding chrome). A single invalidateSize() call risks reading
  // the container at exactly the wrong moment and caching a stale zero size
  // that never gets corrected -- so keep re-checking for the lifetime of the
  // component instead of disconnecting after the first apparent success.
  useEffect(() => {
    const container = map.getContainer();

    const sync = () => {
      if (container.clientWidth === 0) return;
      map.invalidateSize({ animate: false, pan: false });
      setReady(true);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(container);
    const interval = setInterval(sync, 400);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [map]);

  useEffect(() => {
    if (!ready) return;
    const points: LatLngTuple[] = [];
    for (const f of fields) {
      if (!f.boundaryLatLng) continue;
      for (const ring of f.boundaryLatLng) {
        for (const [lat, lng] of ring) points.push([lat, lng]);
      }
    }
    if (points.length === 0) return;
    // Esri's imagery for this area only actually has detail up to ~z17 --
    // past that it serves a "Map data not yet available" placeholder.
    map.fitBounds(latLngBounds(points), { padding: [20, 20], maxZoom: 17, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fields, map]);

  if (!ready) return null;

  return (
    <>
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
    </>
  );
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
        attribution="Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <MapContents fields={fields} selectedFieldId={selectedFieldId} onSelect={onSelect} />
    </MapContainer>
  );
}
