import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeeHistoricalTrends } from "@/lib/roles";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import Link from "next/link";

export default async function TrendsPage() {
  const session = await auth();
  if (!canSeeHistoricalTrends(session?.user)) redirect("/");

  const clients = await prisma.client.findMany({
    include: { orders: true, claims: true },
    orderBy: { name: "asc" },
  });

  const thisYear = new Date().getFullYear();

  const rows = clients
    .map((c) => {
      const lifetimeValue = c.orders.reduce((s, o) => s + o.valueUsd, 0);
      const lifetimeClaims = c.claims
        .filter((claim) => claim.status === "RESOLVED_CREDITED")
        .reduce((s, claim) => s + claim.valueUsd, 0);
      const lifetimeNetValue = lifetimeValue - lifetimeClaims;
      const lifetimeVolume = c.orders.reduce((s, o) => s + o.quantityPallets, 0);
      const thisYearValue = c.orders
        .filter((o) => o.orderDate.getFullYear() === thisYear)
        .reduce((s, o) => s + o.valueUsd, 0);
      const lastYearValue = c.orders
        .filter((o) => o.orderDate.getFullYear() === thisYear - 1)
        .reduce((s, o) => s + o.valueUsd, 0);
      const trend = lastYearValue === 0 ? null : (thisYearValue - lastYearValue) / lastYearValue;
      return { client: c, lifetimeValue, lifetimeNetValue, lifetimeVolume, trend };
    })
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Historical Trends</h1>
          <p className="mt-1 text-sm text-slate-500">Lifetime value and year-over-year trend per client.</p>
        </div>
        <LinkButton href="/trends/import" variant="secondary">
          Import Historical Orders
        </LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Lifetime Gross Value</th>
              <th className="px-4 py-2 font-medium">Lifetime Net Value (after claims)</th>
              <th className="px-4 py-2 font-medium">Lifetime Volume (pallets)</th>
              <th className="px-4 py-2 font-medium">YoY Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ client, lifetimeValue, lifetimeNetValue, lifetimeVolume, trend }) => (
              <tr key={client.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/trends/${client.id}`} className="font-medium text-emerald-700 hover:underline">
                    {client.name}
                  </Link>
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
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
