import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { FieldsExplorer } from "./fields-explorer";
import { PrintButton } from "@/components/ui/print-button";

export default async function FieldsPage() {
  const session = await auth();
  const canEdit = !!session?.user && ["QUALITY", "OWNER"].includes(session.user.role);
  const locale = await resolveLocale();
  const dict = getDictionary(locale).fields;

  // Only MS1 ("Mafa Strawberry — Festival") is actually strawberry -- the
  // farm's GIS map also codes other crops (e.g. MO = Mafa Oranges) under
  // similar-looking variety names, which don't belong here.
  const fields = await prisma.field.findMany({
    where: { farmName: { not: null }, variety: "MS1" },
    orderBy: [{ farmName: "asc" }, { station: "asc" }, { valve: "asc" }],
  });

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle
              .replace("{count}", String(fields.length))
              .replace("{farms}", String(new Set(fields.map((f) => f.farmName)).size))}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-6">
        <FieldsExplorer
          canEdit={canEdit}
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
            latitude: f.latitude,
            longitude: f.longitude,
            boundaryLatLng: f.boundaryLatLng as number[][][] | null,
          }))}
        />
      </div>
    </div>
  );
}
