import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

const REASON_LABEL_KEY = {
  QUALITY: "claimReasonQuality",
  PACKAGING: "claimReasonPackaging",
  FOREIGN_MATERIAL: "claimReasonForeignMaterial",
  TRANSPORT: "claimReasonTransport",
} as const;

const STATUS_LABEL_KEY = {
  OPEN: "claimStatusOpen",
  UNDER_REVIEW: "claimStatusUnderReview",
  RESOLVED_CREDITED: "claimStatusResolvedCredited",
  CLOSED: "claimStatusClosed",
} as const;

export default async function ClaimsPage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.claims;
  const common = fullDict.common;
  const orders = fullDict.orders;

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
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <LinkButton href="/claims/new" className="no-print">
            {dict.fileClaim}
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colClaimNumber}</th>
              <th className="px-4 py-2 font-medium">{orders.colClient}</th>
              <th className="px-4 py-2 font-medium">{common.date}</th>
              <th className="px-4 py-2 font-medium">{dict.colContainers}</th>
              <th className="px-4 py-2 font-medium">{dict.colReason}</th>
              <th className="px-4 py-2 font-medium">{dict.colSeverity}</th>
              {showPricing && <th className="px-4 py-2 font-medium">{orders.colValue}</th>}
              <th className="px-4 py-2 font-medium">{common.status}</th>
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
                <td className="px-4 py-2">{formatDate(c.claimDate, "dd MMM yyyy", locale)}</td>
                <td className="px-4 py-2">{c.containers.length}</td>
                <td className="px-4 py-2">{orders[REASON_LABEL_KEY[c.reason]]}</td>
                <td className="px-4 py-2">
                  <Badge color={c.severity === "RED" ? "red" : "amber"}>
                    {c.severity === "RED" ? orders.claimSeverityRed : orders.claimSeverityAmber}
                  </Badge>
                </td>
                {showPricing && <td className="px-4 py-2">${c.valueUsd.toLocaleString()}</td>}
                <td className="px-4 py-2">
                  <Badge color="slate">{orders[STATUS_LABEL_KEY[c.status]]}</Badge>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noClaimsFiled}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
