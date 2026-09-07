import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeeHistoricalTrends } from "@/lib/roles";
import { isCreditedClaim } from "@/lib/claims";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function TrendsPage() {
  const session = await auth();
  if (!canSeeHistoricalTrends(session?.user)) redirect("/");

  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.trends;

  const clients = await prisma.client.findMany({
    include: { orders: true, claims: true },
    orderBy: { name: "asc" },
  });

  const thisYear = new Date().getFullYear();

  // Sibling entities under one mother company (Client.groupName, e.g.
  // "Chaucer - Linyi"/"Chaucer - Shandong" both grouped under "Chaucer")
  // are combined into a single row here; the row links to a breakdown page
  // listing each member if there's more than one, or straight to that
  // client's own trend page if it's a standalone group of one.
  const groups = new Map<string, typeof clients>();
  for (const c of clients) {
    const key = c.groupName || c.name;
    const group = groups.get(key);
    if (group) group.push(c);
    else groups.set(key, [c]);
  }

  const rows = Array.from(groups.entries())
    .map(([groupKey, members]) => {
      const orders = members.flatMap((c) => c.orders);
      const claims = members.flatMap((c) => c.claims);
      const lifetimeValue = orders.reduce((s, o) => s + o.valueUsd, 0);
      const lifetimeClaims = claims
        .filter((claim) => isCreditedClaim(claim.status))
        .reduce((s, claim) => s + claim.valueUsd, 0);
      const lifetimeNetValue = lifetimeValue - lifetimeClaims;
      const lifetimeVolume = orders.reduce((s, o) => s + o.quantityPallets, 0);
      const thisYearValue = orders
        .filter((o) => o.orderDate.getFullYear() === thisYear)
        .reduce((s, o) => s + o.valueUsd, 0);
      const lastYearValue = orders
        .filter((o) => o.orderDate.getFullYear() === thisYear - 1)
        .reduce((s, o) => s + o.valueUsd, 0);
      const trend = lastYearValue === 0 ? null : (thisYearValue - lastYearValue) / lastYearValue;
      return { groupKey, members, lifetimeValue, lifetimeNetValue, lifetimeVolume, trend };
    })
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/trends/import" variant="secondary" className="no-print">
            {dict.importHistoricalOrders}
          </LinkButton>
          <PrintButton />
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeGrossValue}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeNetValue}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeVolume}</th>
              <th className="px-4 py-2 font-medium">{dict.colYoyTrend}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ groupKey, members, lifetimeValue, lifetimeNetValue, lifetimeVolume, trend }) => {
              const href =
                members.length > 1 ? `/trends/group/${encodeURIComponent(groupKey)}` : `/trends/${members[0].id}`;
              return (
                <tr key={groupKey} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={href} className="font-medium text-emerald-700 hover:underline">
                      {groupKey}
                    </Link>
                    {members.length > 1 && (
                      <Badge color="slate" className="ms-2">
                        {dict.entitiesCount.replace("{count}", String(members.length))}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">${lifetimeValue.toLocaleString()}</td>
                  <td className="px-4 py-2">${lifetimeNetValue.toLocaleString()}</td>
                  <td className="px-4 py-2">{lifetimeVolume}</td>
                  <td className="px-4 py-2">
                    {trend === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <Badge color={trend >= 0 ? "green" : "red"}>
                        {trend >= 0 ? "▲" : "▼"} {Math.abs(trend * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noClientsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
