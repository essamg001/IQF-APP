import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function NonConformancePage() {
  const locale = await resolveLocale();
  const dict = getDictionary(locale).nonConformance;
  const TYPE_LABEL: Record<string, string> = {
    PRODUCT: dict.typeProduct,
    PROCESS: dict.typeProcess,
    EQUIPMENT: dict.typeEquipment,
    DOCUMENTATION: dict.typeDocumentation,
    SUPPLIER: dict.typeSupplier,
    OTHER: dict.typeOther,
  };

  const reports = await prisma.nonConformanceReport.findMany({
    include: { factory: true },
    orderBy: { date: "desc" },
    take: 200,
  });

  const openCount = reports.filter((r) => !r.verifiedAt).length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle}
            {openCount > 0 && (
              <span className="ms-2">
                <Badge color="amber">
                  {openCount} {dict.notYetVerified}
                </Badge>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/non-conformance/new" className="no-print">
            {dict.reportButton}
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colType}</th>
              <th className="px-4 py-2 font-medium">{dict.colLocation}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colReportedBy}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/non-conformance/${r.id}`} className="block text-emerald-700 hover:underline">
                    {formatDate(r.date, "dd MMM yyyy", locale)}
                  </Link>
                </td>
                <td className="px-4 py-2">{TYPE_LABEL[r.ncType] ?? r.ncType}</td>
                <td className="px-4 py-2">{r.location}</td>
                <td className="px-4 py-2">{r.factory.name}</td>
                <td className="px-4 py-2">{r.reportedByName}</td>
                <td className="px-4 py-2">
                  {r.verifiedAt ? <Badge color="green">{dict.verified}</Badge> : <Badge color="amber">{dict.open}</Badge>}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {dict.noReportsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
