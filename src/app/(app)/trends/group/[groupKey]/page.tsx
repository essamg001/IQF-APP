import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeeHistoricalTrends } from "@/lib/roles";
import { isCreditedClaim } from "@/lib/claims";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { YearlyChart } from "../../[clientId]/yearly-chart";
import { GrossNetChart } from "../../[clientId]/gross-net-chart";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function ClientGroupTrendPage({ params }: { params: Promise<{ groupKey: string }> }) {
  const session = await auth();
  if (!canSeeHistoricalTrends(session?.user)) redirect("/");

  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.trends;

  const { groupKey: encodedGroupKey } = await params;
  const groupKey = decodeURIComponent(encodedGroupKey);

  const members = await prisma.client.findMany({
    where: { OR: [{ groupName: groupKey }, { name: groupKey }] },
    include: { orders: true, claims: true },
    orderBy: { name: "asc" },
  });
  if (members.length === 0) notFound();

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => thisYear - 4 + i);

  const orders = members.flatMap((c) => c.orders);
  const creditedClaims = members.flatMap((c) => c.claims).filter((c) => isCreditedClaim(c.status));

  const grossByYear = years.map((year) =>
    orders.filter((o) => o.orderDate.getFullYear() === year).reduce((s, o) => s + o.valueUsd, 0)
  );
  const claimsByYear = years.map((year) =>
    creditedClaims.filter((c) => c.claimDate.getFullYear() === year).reduce((s, c) => s + c.valueUsd, 0)
  );
  const netByYear = grossByYear.map((gross, i) => gross - claimsByYear[i]);

  const valueByYear = years.map((year, i) => ({ year: String(year), gross: grossByYear[i], net: netByYear[i] }));

  const volumeByYear = years.map((year) => ({
    year: String(year),
    value: orders.filter((o) => o.orderDate.getFullYear() === year).reduce((s, o) => s + o.quantityPallets, 0),
  }));

  const lifetimeValue = orders.reduce((s, o) => s + o.valueUsd, 0);
  const lifetimeClaims = creditedClaims.reduce((s, c) => s + c.valueUsd, 0);
  const lifetimeNetValue = lifetimeValue - lifetimeClaims;

  const memberRows = members
    .map((c) => {
      const cLifetimeValue = c.orders.reduce((s, o) => s + o.valueUsd, 0);
      const cLifetimeClaims = c.claims
        .filter((claim) => isCreditedClaim(claim.status))
        .reduce((s, claim) => s + claim.valueUsd, 0);
      const cLifetimeNetValue = cLifetimeValue - cLifetimeClaims;
      const cLifetimeVolume = c.orders.reduce((s, o) => s + o.quantityPallets, 0);
      return { client: c, lifetimeValue: cLifetimeValue, lifetimeNetValue: cLifetimeNetValue, lifetimeVolume: cLifetimeVolume };
    })
    .sort((a, b) => b.lifetimeValue - a.lifetimeValue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.groupTrendTitle.replace("{group}", groupKey)}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {dict.groupLifetimeSummary
            .replace("{gross}", `$${lifetimeValue.toLocaleString()}`)
            .replace("{net}", `$${lifetimeNetValue.toLocaleString()}`)
            .replace("{count}", String(members.length))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.orderValueByYearTitle}</h2>
          <GrossNetChart data={valueByYear} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.volumeByYearTitle}</h2>
          <YearlyChart data={volumeByYear} dataKey="value" unit="pallets" />
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">{dict.breakdownByEntityTitle}</h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colEntity}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeGrossValue}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeNetValue}</th>
              <th className="px-4 py-2 font-medium">{dict.colLifetimeVolume}</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.map(({ client, lifetimeValue: v, lifetimeNetValue: n, lifetimeVolume: vol }) => (
              <tr key={client.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/trends/${client.id}`} className="font-medium text-emerald-700 hover:underline">
                    {client.name}
                  </Link>
                </td>
                <td className="px-4 py-2">${v.toLocaleString()}</td>
                <td className="px-4 py-2">${n.toLocaleString()}</td>
                <td className="px-4 py-2">{vol}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">{dict.combinedYearlyDetailTitle}</h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colYear}</th>
              <th className="px-4 py-2 font-medium">{dict.colGrossValueUsd}</th>
              <th className="px-4 py-2 font-medium">{dict.colCreditedClaimsUsd}</th>
              <th className="px-4 py-2 font-medium">{dict.colNetValueUsd}</th>
              <th className="px-4 py-2 font-medium">{dict.colVolumePallets}</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year, i) => (
              <tr key={year} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{year}</td>
                <td className="px-4 py-2">${grossByYear[i].toLocaleString()}</td>
                <td className="px-4 py-2">${claimsByYear[i].toLocaleString()}</td>
                <td className="px-4 py-2 font-medium">${netByYear[i].toLocaleString()}</td>
                <td className="px-4 py-2">{volumeByYear[i].value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
