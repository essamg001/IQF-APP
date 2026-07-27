import { prisma } from "@/lib/prisma";
import { FieldsExplorer } from "./fields-explorer";

export default async function FieldsPage() {
  // Only MS1 ("Mafa Strawberry — Festival") is actually strawberry -- the
  // farm's GIS map also codes other crops (e.g. MO = Mafa Oranges) under
  // similar-looking variety names, which don't belong here.
  const fields = await prisma.field.findMany({
    where: { farmName: { not: null }, variety: "MS1" },
    orderBy: [{ farmName: "asc" }, { station: "asc" }, { valve: "asc" }],
  });

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Fields</h1>
        <p className="mt-1 text-sm text-slate-500">
          Mafa Strawberry (Festival variety) plots, from the farm&apos;s GIS map — {fields.length} plots across{" "}
          {new Set(fields.map((f) => f.farmName)).size} farm(s). Click a plot for details.
        </p>
      </div>

      <div className="mt-6">
        <FieldsExplorer
          fields={fields.map((f) => ({
            id: f.id,
            name: f.name,
            farmName: f.farmName!,
            station: f.station,
            valve: f.valve,
            variety: f.variety,
            areaFeddans: f.areaFeddans,
            plantingDate: f.plantingDate,
            avgTonPerFeddan: f.avgTonPerFeddan,
            googleMapsUrl: f.googleMapsUrl,
            centroidX: f.centroidX,
            centroidY: f.centroidY,
            boundary: f.boundary as number[][][] | null,
          }))}
        />
      </div>
    </div>
  );
}
