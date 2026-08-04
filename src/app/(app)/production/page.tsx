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

const MICRO_COLOR = {
  PENDING: "amber",
  SENT_TO_LAB: "blue",
  APPROVED: "green",
  FAILED_MINOR: "amber",
  FAILED_SEVERE: "red",
  ON_HOLD: "red",
} as const;

export default async function ProductionPage() {
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
          <h1 className="text-xl font-semibold text-slate-900">Production Lots</h1>
          <p className="mt-1 text-sm text-slate-500">Each lot ties a shift&apos;s output to pallets, quality, and microbiology.</p>
        </div>
        <LinkButton href="/production/new">Log Production Lot</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lot #</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Factory</th>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Grade</th>
              <th className="px-4 py-2 font-medium">Format</th>
              <th className="px-4 py-2 font-medium">Pallets</th>
              <th className="px-4 py-2 font-medium">Microbiology</th>
              <th className="px-4 py-2 font-medium">Total Plate Count</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/production/${lot.id}`} className="font-medium text-emerald-700 hover:underline">
                    {lot.lotNumber}
                  </Link>
                  {lot.isEndOfDayGradeB && (
                    <span className="ml-2 text-xs text-slate-400">(end-of-day)</span>
                  )}
                </td>
                <td className="px-4 py-2">{format(lot.shift.date, "dd MMM yyyy")}</td>
                <td className="px-4 py-2">{lot.factory.name}</td>
                <td className="px-4 py-2">{lot.field.name}</td>
                <td className="px-4 py-2">
                  <Badge color={lot.grade === "A" ? "green" : "amber"}>Grade {lot.grade}</Badge>
                </td>
                <td className="px-4 py-2">{FORMAT_LABEL[lot.format]}</td>
                <td className="px-4 py-2">{lot._count.pallets}</td>
                <td className="px-4 py-2">
                  {(() => {
                    const micro = combinedMicroStatus(lot.microbiologyResults, lot.shift.onHold);
                    return <Badge color={MICRO_COLOR[micro]}>{micro.replace("_", " ")}</Badge>;
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
                  No production lots logged yet.
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
