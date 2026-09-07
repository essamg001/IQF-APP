import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";
import type { HaccpHazardCategory } from "@prisma/client";

const CATEGORY_ORDER: HaccpHazardCategory[] = [
  "BIOLOGICAL",
  "CHEMICAL",
  "PHYSICAL",
  "ALLERGEN",
  "FRAUD",
  "SECURITY",
  "RADIOLOGICAL",
];

export default async function HaccpHazardAnalysisPage() {
  const session = await auth();
  if (!session?.user || !["OWNER", "QUALITY", "PRODUCTION"].includes(session.user.role)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.haccpHazardAnalysis;
  const flowSteps = fullDict.haccpFlowDiagram.steps;
  const CATEGORY_LABEL: Record<HaccpHazardCategory, string> = {
    BIOLOGICAL: dict.categoryBiological,
    CHEMICAL: dict.categoryChemical,
    PHYSICAL: dict.categoryPhysical,
    ALLERGEN: dict.categoryAllergen,
    FRAUD: dict.categoryFraud,
    SECURITY: dict.categorySecurity,
    RADIOLOGICAL: dict.categoryRadiological,
  };

  const hazards = await prisma.haccpHazard.findMany({ orderBy: { sortOrder: "asc" } });

  const byStep = new Map<string, typeof hazards>();
  for (const h of hazards) {
    const list = byStep.get(h.processStepNumber) ?? [];
    list.push(h);
    byStep.set(h.processStepNumber, list);
  }
  const stepNumbers = [...byStep.keys()].sort((a, b) => Number(a) - Number(b));

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>{dict.docMetaIssue}</span>
        <span>{dict.docMetaIssueDate}</span>
        <span>{dict.docMetaUpdated}</span>
      </div>

      <Card className="mt-6 border-amber-200 bg-amber-50">
        <p className="text-xs leading-relaxed text-amber-800">{dict.languageNote}</p>
      </Card>

      <div className="mt-6 space-y-4">
        {stepNumbers.map((stepNumber) => {
          const stepHazards = byStep.get(stepNumber)!;
          const flowStep = flowSteps.find((s) => s.n === stepNumber || s.n.startsWith(stepNumber));
          const hasCcp = stepHazards.some((h) => h.isCcp);

          return (
            <Card key={stepNumber} className={hasCcp ? "border-red-300 bg-red-50/40" : undefined}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{stepNumber}</span>
                <h2 className="text-sm font-semibold text-slate-900">{flowStep?.name ?? stepNumber}</h2>
                {hasCcp && <Badge color="red">{dict.ccpBadge}</Badge>}
              </div>

              <div className="mt-3 space-y-2">
                {CATEGORY_ORDER.map((category) => {
                  const rows = stepHazards.filter((h) => h.category === category);
                  if (rows.length === 0) return null;
                  return (
                    <div key={category} className="border-t border-slate-100 pt-2 first:border-t-0 first:pt-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {CATEGORY_LABEL[category]}
                      </p>
                      {rows.every((r) => !r.hazardArabic) ? (
                        <p className="mt-1 text-xs text-slate-400">{dict.noHazardIdentified}</p>
                      ) : (
                        <div className="mt-1 space-y-2">
                          {rows
                            .filter((r) => r.hazardArabic)
                            .map((r) => (
                              <div
                                key={r.id}
                                className={`rounded-md border p-2.5 text-sm ${r.isCcp ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  {r.isCcp && <Badge color="red">{dict.ccpBadge}</Badge>}
                                  {r.probability != null && r.severity != null && r.result != null && (
                                    <span className="font-mono text-xs text-slate-400">
                                      {dict.pslLabel
                                        .replace("{p}", String(r.probability))
                                        .replace("{s}", String(r.severity))
                                        .replace("{r}", String(r.result))}
                                    </span>
                                  )}
                                  {r.resultLabel && (
                                    <Badge color={r.resultLabel === "WEAK" ? "slate" : "amber"}>
                                      {r.resultLabel === "WEAK" ? dict.resultWeak : dict.resultMedium}
                                    </Badge>
                                  )}
                                </div>
                                <p dir="rtl" lang="ar" className="mt-1.5 text-slate-800">
                                  {r.hazardArabic}
                                </p>
                                {r.controlsArabic && (
                                  <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                                    <p className="text-xs font-medium text-slate-500">{dict.controlsLabel}</p>
                                    <p dir="rtl" lang="ar" className="mt-0.5 whitespace-pre-line text-slate-600">
                                      {r.controlsArabic}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
