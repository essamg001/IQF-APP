import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

export default async function QualityIssuesPage() {
  const issues = await prisma.qualityIssue.findMany({
    include: { client: true },
    orderBy: { issueDate: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quality Issues</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quality problems reported without a financial claim — logged for process improvement, not compensation.
          </p>
        </div>
        <LinkButton href="/quality-issues/new">Report Issue</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">Status</th>
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
                <td className="px-4 py-2">{i.reason.replace("_", " ")}</td>
                <td className="px-4 py-2">
                  <Badge color={i.status === "OPEN" ? "amber" : "green"}>{i.status}</Badge>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No quality issues logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
