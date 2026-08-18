import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";
import { combinedMicroStatus } from "@/lib/microbiology";
import { combinedCfuValue } from "@/lib/cfuTier";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { CfuTierLegend } from "@/components/cfu-tier-legend";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const MICRO_COLOR = {
  PENDING: "amber",
  SENT_TO_LAB: "blue",
  APPROVED: "green",
  FAILED_MINOR: "amber",
  FAILED_SEVERE: "red",
  ON_HOLD: "red",
} as const;

export default async function ProductionPage() {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.production;
  const labDict = fullDict.lab;
  const MICRO_LABEL: Record<string, string> = {
    PENDING: labDict.statusPending,
    SENT_TO_LAB: labDict.statusSentToLab,
    APPROVED: labDict.statusApproved,
    FAILED_MINOR: labDict.statusFailedMinor,
    FAILED_SEVERE: labDict.statusFailedSevere,
    ON_HOLD: labDict.statusOnHold,
  };
  const lots = await prisma.productionLot.findMany({
    include: {
      shift: true,
      factory: true,
      field: true,
      microbiologyResults: true,
      _count: { select: { pallets: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <LinkButton href="/production/new">{dict.logProductionLot}</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colLotNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colField}</th>
              <th className="px-4 py-2 font-medium">{dict.colGrade}</th>
              <th className="px-4 py-2 font-medium">{dict.colFormat}</th>
              <th className="px-4 py-2 font-medium">{dict.colPallets}</th>
              <th className="px-4 py-2 font-medium">{dict.colMicrobiology}</th>
              <th className="px-4 py-2 font-medium">{dict.colTotalPlateCount}</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/production/${lot.id}`}
                    className={cn("font-medium text-emerald-700 hover:underline", lot.isTestData && TEST_DATA_TEXT_CLASS)}
                  >
                    {lot.lotNumber}
                  </Link>
                  {lot.isEndOfDayGradeB && (
                    <span className="ms-2 text-xs text-slate-400">{dict.endOfDaySuffix}</span>
                  )}
                  {lot.isTestData && (
                    <>
                      {" "}
                      <TestDataBadge />
                    </>
                  )}
                </td>
                <td className="px-4 py-2">{format(lot.shift.date, "dd MMM yyyy")}</td>
                <td className="px-4 py-2">{lot.factory.name}</td>
                <td className="px-4 py-2">{lot.field.name}</td>
                <td className="px-4 py-2">
                  <Badge color={lot.grade === "A" ? "green" : "amber"}>{dict.gradeLabel.replace("{grade}", lot.grade)}</Badge>
                </td>
                <td className="px-4 py-2">{FORMAT_LABEL[lot.format]}</td>
                <td className="px-4 py-2">{lot._count.pallets}</td>
                <td className="px-4 py-2">
                  {(() => {
                    const micro = combinedMicroStatus(lot.microbiologyResults, lot.shift.onHold);
                    return <Badge color={MICRO_COLOR[micro]}>{MICRO_LABEL[micro] ?? micro}</Badge>;
                  })()}
                </td>
                <td className="px-4 py-2">
                  <CfuTierBadge cfuValue={combinedCfuValue(lot.microbiologyResults)} />
                </td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  {dict.noProductionLotsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <CfuTierLegend className="mt-3" />
    </div>
  );
}
