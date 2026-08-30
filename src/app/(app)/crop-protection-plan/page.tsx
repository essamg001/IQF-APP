import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { CropProtectionGrowthStage } from "@prisma/client";

const STAGES: CropProtectionGrowthStage[] = ["MOTHER_PLANTS", "NURSERY", "OPEN_FIELD", "UNIDO_GREENHOUSE"];

export default async function CropProtectionPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const dict = getDictionary(locale).cropProtectionPlan;
  const { stage: stageParam } = await searchParams;
  const stage: CropProtectionGrowthStage = STAGES.includes(stageParam as CropProtectionGrowthStage)
    ? (stageParam as CropProtectionGrowthStage)
    : "MOTHER_PLANTS";

  const STAGE_LABEL: Record<CropProtectionGrowthStage, string> = {
    MOTHER_PLANTS: dict.stageMotherPlants,
    NURSERY: dict.stageNursery,
    OPEN_FIELD: dict.stageOpenField,
    UNIDO_GREENHOUSE: dict.stageUnidoGreenhouse,
  };

  const TREATMENT_METHOD_LABEL: Record<string, string> = {
    SPRAYING: dict.methodSpraying,
    INJECTION: dict.methodInjection,
    DUSTING: dict.methodDusting,
    FUMIGATION: dict.methodFumigation,
    STERILIZATION: dict.methodSterilization,
    DISTRIBUTION_OF_NATURAL_ENEMIES: dict.methodDistribution,
    THROUGH_DRIP_LINES: dict.methodThroughDripLines,
  };

  const CATEGORY_LABEL: Record<string, string> = {
    BIOLOGICAL: dict.categoryBiological,
    CHEMICAL: dict.categoryChemical,
    NATURAL_ENEMIES: dict.categoryNaturalEnemies,
  };

  const plan = await prisma.cropProtectionPlan.findFirst({
    where: { growthStage: stage, isCanonical: true },
    include: { entries: { orderBy: [{ isPending: "asc" }, { targetPestOrDisease: "asc" }] } },
  });

  const realEntries = plan?.entries.filter((e) => !e.isPending) ?? [];
  const pendingEntries = plan?.entries.filter((e) => e.isPending) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        {plan && <LinkButton href={`/crop-protection-plan/${plan.id}/entries/new`}>{dict.addEntry}</LinkButton>}
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {STAGES.map((s) => (
          <Link
            key={s}
            href={`/crop-protection-plan?stage=${s}`}
            className={`rounded-t-md px-4 py-2 text-sm font-medium ${
              s === stage
                ? "border border-b-0 border-slate-200 bg-white text-emerald-700"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {STAGE_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="space-y-4 rounded-tl-none border border-t-0 border-slate-200 bg-slate-50/40 p-4">
        {plan && (
          <Card>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
              <Row label={dict.farmNameLabel} value={plan.farmName} />
              <Row label={dict.exportSeasonLabel} value={plan.exportSeason} />
              <Row label={dict.cropNameLabel} value={plan.cropName} />
              <Row label={dict.varietyLabel} value={plan.variety} />
              <Row label={dict.developedByLabel} value={plan.developedBy} />
              <Row label={dict.revisedByLabel} value={plan.revisedBy} />
              <Row label={dict.approvedByLabel} value={plan.approvedBy} />
              <Row label={dict.versionDateLabel} value={formatDate(plan.versionDate, "dd MMM yyyy", locale)} />
            </dl>
            {plan.isSkeleton && <p className="mt-3 text-sm font-medium text-amber-600">{dict.skeletonNotice}</p>}
            {plan.notes && <p className="mt-3 text-xs text-slate-500">{plan.notes}</p>}
            {plan.hazardListNote && <p className="mt-3 text-xs text-slate-400">{plan.hazardListNote}</p>}
          </Card>
        )}

        {plan && realEntries.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">{dict.colTarget}</th>
                  <th className="px-3 py-2 font-medium">{dict.colGrowthStage}</th>
                  <th className="px-3 py-2 font-medium">{dict.colMethod}</th>
                  <th className="px-3 py-2 font-medium">{dict.colCategory}</th>
                  <th className="px-3 py-2 font-medium">{dict.colProduct}</th>
                  <th className="px-3 py-2 font-medium">{dict.colDose}</th>
                  <th className="px-3 py-2 font-medium">{dict.colPhi}</th>
                  <th className="px-3 py-2 font-medium">{dict.colMrl}</th>
                  <th className="px-3 py-2 font-medium">{dict.colWindow}</th>
                  <th className="px-3 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {realEntries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{e.targetPestOrDisease}</td>
                    <td className="px-3 py-2 text-slate-600">{e.plantGrowthStage ?? "—"}</td>
                    <td className="px-3 py-2">
                      {e.treatmentMethod ? (
                        <Badge color="slate">{TREATMENT_METHOD_LABEL[e.treatmentMethod]}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {e.category ? (
                        <Badge color={e.category === "CHEMICAL" ? "amber" : "green"}>{CATEGORY_LABEL[e.category]}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {e.commercialProductName}
                      {e.activeIngredient && <span className="block text-xs text-slate-400">{e.activeIngredient}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{e.dosePerFeddan ?? e.dosePer100L ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.proposedPhiDays ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.strictestMrlLimitMgKg ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{e.applicationTimeWindow ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/crop-protection-plan/${plan.id}/entries/${e.id}/edit`}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        {dict.editLink}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {plan && pendingEntries.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">{dict.pendingTitle}</h2>
            <p className="mt-1 text-xs text-slate-500">{dict.pendingSubtitle}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {pendingEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span>{e.commercialProductName}</span>
                  <Link
                    href={`/crop-protection-plan/${plan.id}/entries/${e.id}/edit`}
                    className="text-xs text-emerald-700 hover:underline"
                  >
                    {dict.editLink}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {plan && plan.entries.length === 0 && (
          <Card>
            <p className="text-sm text-slate-400">{dict.noEntriesYet}</p>
          </Card>
        )}

        {!plan && (
          <Card>
            <p className="text-sm text-slate-400">{dict.noPlanYet}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}
