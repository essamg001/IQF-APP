import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeeCosting } from "@/lib/roles";
import { getCompanySettings } from "@/lib/companySettings";
import { shiftCostPerTonneEgp, computeContainerMargin } from "@/lib/costing";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function CostingPage() {
  const session = await auth();
  if (!canSeeCosting(session?.user)) redirect("/");

  const [containers, shifts, claimLines, companySettings] = await Promise.all([
    prisma.container.findMany({
      include: {
        order: { include: { client: true } },
        palletLines: { include: { pallet: { include: { lot: true } } } },
        costs: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.shiftLog.findMany({
      include: { lots: { include: { pallets: { select: { weightTonnes: true } } } } },
    }),
    prisma.claimContainerLine.findMany({ where: { containerId: { not: null } } }),
    getCompanySettings(),
  ]);

  const costPerTonneEgpByShift = new Map(
    shifts.map((s) => {
      const totalTonnage = s.lots.reduce((sum, lot) => sum + lot.pallets.reduce((ps, p) => ps + p.weightTonnes, 0), 0);
      return [s.id, shiftCostPerTonneEgp(s, totalTonnage)];
    })
  );

  const claimsByContainer = new Map<string, number>();
  for (const line of claimLines) {
    if (!line.containerId) continue;
    claimsByContainer.set(line.containerId, (claimsByContainer.get(line.containerId) ?? 0) + (line.claimAmount ?? 0));
  }

  // Total loaded tonnage per order (across every container of that order) --
  // needed to apportion Order.valueUsd when a container has no price/kg or
  // price/carton of its own set.
  const orderLoadedTonnage = new Map<string, number>();
  for (const c of containers) {
    const loaded = c.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
    orderLoadedTonnage.set(c.orderId, (orderLoadedTonnage.get(c.orderId) ?? 0) + loaded);
  }

  const containerMargins = containers.map((c) => {
    const totalLoaded = c.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
    const totalCartons = c.palletLines.reduce((sum, line) => {
      if (!line.pallet.totalCartons || line.pallet.weightTonnes <= 0) return sum;
      return sum + line.pallet.totalCartons * Math.min(1, line.quantityTonnes / line.pallet.weightTonnes);
    }, 0);

    const valueByWeightUsd = c.pricePerKgUsd != null ? c.pricePerKgUsd * totalLoaded * 1000 : null;
    const valueByCartonUsd = c.pricePerCartonUsd != null ? c.pricePerCartonUsd * totalCartons : null;
    const orderTonnage = orderLoadedTonnage.get(c.orderId) ?? 0;
    const revenueUsd =
      valueByWeightUsd ?? valueByCartonUsd ?? (orderTonnage > 0 ? c.order.valueUsd * (totalLoaded / orderTonnage) : null);

    let rawMaterialAndLaborEgp: number | null = 0;
    for (const line of c.palletLines) {
      const rate = costPerTonneEgpByShift.get(line.pallet.lot.shiftId);
      if (rate == null) {
        rawMaterialAndLaborEgp = null;
        break;
      }
      rawMaterialAndLaborEgp += rate * line.quantityTonnes;
    }

    const margin = computeContainerMargin({
      revenueUsd,
      rawMaterialAndLaborEgp,
      fxRateEgpPerUsd: companySettings.fxRateEgpPerUsd,
      packagingCostUsd: c.palletLines.reduce((s, l) => s + (l.pallet.packagingCostUsd ?? 0), 0),
      logisticsCostUsd: c.costs.reduce((s, cost) => s + cost.amountUsd, 0),
      claimsUsd: claimsByContainer.get(c.id) ?? 0,
    });

    return { container: c, margin };
  });

  // Group by the same Client.groupName convention as /trends, so sibling
  // entities (e.g. Chaucer - Linyi / Chaucer - Shandong) roll up together.
  const groups = new Map<string, typeof containerMargins>();
  for (const cm of containerMargins) {
    const key = cm.container.order.client.groupName || cm.container.order.client.name;
    const group = groups.get(key);
    if (group) group.push(cm);
    else groups.set(key, [cm]);
  }

  const rows = Array.from(groups.entries())
    .map(([groupKey, group]) => {
      const costed = group.filter((cm) => cm.margin.marginUsd != null);
      const revenueUsd = costed.reduce((s, cm) => s + (cm.margin.revenueUsd ?? 0), 0);
      const marginUsd = costed.reduce((s, cm) => s + (cm.margin.marginUsd ?? 0), 0);
      return { groupKey, totalContainers: group.length, costedContainers: costed.length, revenueUsd, marginUsd };
    })
    .filter((r) => r.totalContainers > 0)
    .sort((a, b) => b.marginUsd - a.marginUsd);

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Costing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Margin per client — revenue less raw material, labor, packaging, logistics costs, and claims. A
          container only counts toward these totals once its shift(s) have raw-material/labor cost entered;
          the "Costed" column shows how many of each client's containers currently have that.
        </p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Costed</th>
              <th className="px-4 py-2 font-medium">Revenue</th>
              <th className="px-4 py-2 font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.groupKey} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-900">{r.groupKey}</td>
                <td className="px-4 py-2">
                  <Badge color={r.costedContainers === r.totalContainers ? "green" : "amber"}>
                    {r.costedContainers} / {r.totalContainers} containers
                  </Badge>
                </td>
                <td className="px-4 py-2">${r.revenueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className={`px-4 py-2 font-medium ${r.marginUsd < 0 ? "text-red-600" : "text-emerald-700"}`}>
                  ${r.marginUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No containers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Per-shipment detail — including exactly which cost is missing — is on each container&apos;s own page under{" "}
        <Link href="/logistics" className="text-emerald-700 hover:underline">
          Logistics
        </Link>
        .
      </p>
    </div>
  );
}
