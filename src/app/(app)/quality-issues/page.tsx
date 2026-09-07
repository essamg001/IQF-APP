import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function QualityIssuesPage() {
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.qualityIssues;
  const REASON_LABEL: Record<string, string> = {
    QUALITY: fullDict.orders.claimReasonQuality,
    PACKAGING: fullDict.orders.claimReasonPackaging,
    FOREIGN_MATERIAL: fullDict.orders.claimReasonForeignMaterial,
    TRANSPORT: fullDict.orders.claimReasonTransport,
  };
  const STATUS_LABEL: Record<string, string> = {
    OPEN: dict.statusOpen,
    RESOLVED: dict.statusResolved,
  };
  const issues = await prisma.qualityIssue.findMany({
    include: { client: true },
    orderBy: { issueDate: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="no-print flex items-center gap-2">
          <PrintButton />
          <LinkButton href="/quality-issues/new">{dict.reportIssue}</LinkButton>
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.colReference}</th>
              <th className="px-4 py-2 font-medium">{dict.colReason}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/quality-issues/${i.id}`} className="font-medium text-emerald-700 hover:underline">
                    {format(i.issueDate, "dd MMM yyyy")}
                  </Link>
                </td>
                <td className="px-4 py-2">{i.client?.name ?? "—"}</td>
                <td className="px-4 py-2">{i.relatedReference ?? "—"}</td>
                <td className="px-4 py-2">{REASON_LABEL[i.reason] ?? i.reason}</td>
                <td className="px-4 py-2">
                  <Badge color={i.status === "OPEN" ? "amber" : "green"}>{STATUS_LABEL[i.status] ?? i.status}</Badge>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noIssuesLogged}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
