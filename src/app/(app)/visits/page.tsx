import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { canAccessVisits } from "@/lib/roles";
import { VisitForm } from "./visit-form";
import { PrintButton } from "@/components/ui/print-button";

export default async function VisitsPage() {
  const session = await auth();
  if (!canAccessVisits(session?.user)) {
    redirect("/");
  }

  const locale = await resolveLocale();
  const dict = getDictionary(locale).visits;

  const [visits, factories, allForOptions] = await Promise.all([
    prisma.factoryVisit.findMany({
      include: { factory: true, findings: true },
      orderBy: { date: "desc" },
      take: 200,
    }),
    prisma.factory.findMany({ orderBy: { name: "asc" } }),
    prisma.factoryVisit.findMany({
      select: { organization: true, purpose: true },
      take: 1000,
    }),
  ]);

  const knownOrganizations = [...new Set(allForOptions.map((v) => v.organization).filter((v): v is string => !!v))].sort();
  const knownPurposes = [...new Set(allForOptions.map((v) => v.purpose))].sort();

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <div className="no-print mt-6 max-w-xl">
        <VisitForm factories={factories} knownOrganizations={knownOrganizations} knownPurposes={knownPurposes} />
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colVisitor}</th>
              <th className="px-4 py-2 font-medium">{dict.colOrganization}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colPurpose}</th>
              <th className="px-4 py-2 font-medium">{dict.colType}</th>
              <th className="px-4 py-2 font-medium">{dict.colFindings}</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">{formatDate(v.date, "dd MMM yyyy", locale)}</td>
                <td className="px-4 py-2">
                  <Link href={`/visits/${v.id}`} className="font-medium text-emerald-700 hover:underline">
                    {v.visitorNames.join(", ")}
                  </Link>
                </td>
                <td className="px-4 py-2">{v.organization ?? "—"}</td>
                <td className="px-4 py-2">{v.factory.name}</td>
                <td className="px-4 py-2">{v.purpose}</td>
                <td className="px-4 py-2">
                  {v.isAudit ? <Badge color="blue">{dict.auditBadge}</Badge> : <Badge color="slate">{dict.visitBadge}</Badge>}
                </td>
                <td className="px-4 py-2">{v.isAudit ? v.findings.length : "—"}</td>
              </tr>
            ))}
            {visits.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noVisitsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
