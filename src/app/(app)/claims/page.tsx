import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

export default async function ClaimsPage() {
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);

  const claims = await prisma.claim.findMany({
    include: { client: true, containers: true },
    orderBy: { claimDate: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Claims</h1>
          <p className="mt-1 text-sm text-slate-500">Client claims — can span multiple containers per claim.</p>
        </div>
        <LinkButton href="/claims/new">File Claim</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Claim #</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Containers</th>
              <th className="px-4 py-2 font-medium">Reason</th>
              <th className="px-4 py-2 font-medium">Severity</th>
              {showPricing && <th className="px-4 py-2 font-medium">Value</th>}
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/claims/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                    {c.claimNumber || c.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.client.name}</td>
                <td className="px-4 py-2">{format(c.claimDate, "dd MMM yyyy")}</td>
                <td className="px-4 py-2">{c.containers.length}</td>
                <td className="px-4 py-2">{c.reason.replace("_", " ")}</td>
                <td className="px-4 py-2">
                  <Badge color={c.severity === "RED" ? "red" : "amber"}>{c.severity}</Badge>
                </td>
                {showPricing && <td className="px-4 py-2">${c.valueUsd.toLocaleString()}</td>}
                <td className="px-4 py-2">
                  <Badge color="slate">{c.status.replace("_", " ")}</Badge>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No claims filed.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
