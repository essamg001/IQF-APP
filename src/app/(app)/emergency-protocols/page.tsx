import Link from "next/link";
import { Card } from "@/components/ui/card";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const TYPES = ["fire", "ammoniaLeak", "medicalEmergency", "chemicalSpill", "evacuation"] as const;
type EmergencyType = (typeof TYPES)[number];

const TYPE_PARAM: Record<EmergencyType, string> = {
  fire: "fire",
  ammoniaLeak: "ammonia",
  medicalEmergency: "medical",
  chemicalSpill: "spill",
  evacuation: "evacuation",
};
const PARAM_TYPE: Record<string, EmergencyType> = {
  fire: "fire",
  ammonia: "ammoniaLeak",
  medical: "medicalEmergency",
  spill: "chemicalSpill",
  evacuation: "evacuation",
};

export default async function EmergencyProtocolsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).emergencyProtocols;
  const { type: typeParam } = await searchParams;
  const type: EmergencyType = (typeParam && PARAM_TYPE[typeParam]) || "fire";

  const TYPE_LABEL: Record<EmergencyType, string> = {
    fire: dict.typeFire,
    ammoniaLeak: dict.typeAmmoniaLeak,
    medicalEmergency: dict.typeMedicalEmergency,
    chemicalSpill: dict.typeChemicalSpill,
    evacuation: dict.typeEvacuation,
  };

  const section = dict.sections[type];

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {dict.placeholderNotice}
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/emergency-protocols?type=${TYPE_PARAM[t]}`}
            className={`rounded-t-md px-4 py-2 text-sm font-medium ${
              t === type
                ? "border border-b-0 border-slate-200 bg-white text-emerald-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="rounded-tl-none border border-t-0 border-slate-200 bg-slate-50/40 p-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
          {section.intro && <p className="mt-1 text-xs text-slate-500">{section.intro}</p>}
          <ol className="mt-3 list-decimal space-y-2 ps-5 text-sm text-slate-700">
            {section.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
