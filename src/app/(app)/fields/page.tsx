import { prisma } from "@/lib/prisma";
import { FieldsExplorer } from "./fields-explorer";

export default async function FieldsPage() {
  const fields = await prisma.field.findMany({
    where: { farmName: { not: null } },
    orderBy: [{ farmName: "asc" }, { station: "asc" }, { valve: "asc" }],
  });

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Fields</h1>
        <p className="mt-1 text-sm text-slate-500">
          Real farm layout imported from the farm&apos;s GIS map — {fields.length} strawberry plots across{" "}
          {new Set(fields.map((f) => f.farmName)).size} farms. Select a farm to see its field layout; click a
          plot for details.
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
