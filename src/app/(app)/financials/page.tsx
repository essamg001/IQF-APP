import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canSeeFinancials } from "@/lib/roles";
import { isCreditedClaim } from "@/lib/claims";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, FieldGroup } from "@/components/ui/field";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { updateOrderValueAction } from "../orders/actions";
import { updateContainerValueAction, removeContainerCostAction } from "../logistics/actions";
import { AddCostForm } from "../logistics/[id]/add-cost-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";
import Link from "next/link";
import {
  getPurchasingSpendUsd,
  getRawMaterialCostUsd,
  getPackagingCostUsd,
  getWasteCostUsd,
  getLogisticsCostByCategory,
  getLaborCostUsd,
} from "@/lib/financials";

const CLAIM_REASON_LABEL_KEY = {
  QUALITY: "claimReasonQuality",
  PACKAGING: "claimReasonPackaging",
  FOREIGN_MATERIAL: "claimReasonForeignMaterial",
  TRANSPORT: "claimReasonTransport",
} as const;

const CLAIM_STATUS_LABEL_KEY = {
  OPEN: "claimStatusOpen",
  UNDER_REVIEW: "claimStatusUnderReview",
  RESOLVED_CREDITED: "claimStatusResolvedCredited",
  CLOSED: "claimStatusClosed",
} as const;

// Same math as the order detail page used to run before its value display
// moved here: a claim can list several containers, each with its own
// claimAmount, so summing only containers[0] would silently drop every
// other container's credit for a claim spanning more than one order.
async function computeNetOrderValue(order: { valueUsd: number; containers: { id: string }[] }) {
  const containerIds = order.containers.map((c) => c.id);
  if (containerIds.length === 0) return order.valueUsd;

  const relatedClaims = await prisma.claim.findMany({
    where: { containers: { some: { containerId: { in: containerIds } } } },
    include: {
      containers: { where: { containerId: { in: containerIds } } },
      _count: { select: { containers: true } },
    },
  });

  return (
    order.valueUsd -
    relatedClaims
      .filter((c) => isCreditedClaim(c.status))
      .reduce((sum, c) => {
        const matchedTotal = c.containers.reduce((s, line) => s + (line.claimAmount ?? 0), 0);
        const everyMatchedLineHasAmount = c.containers.length > 0 && c.containers.every((line) => line.claimAmount != null);
        const claimIsFullyWithinThisOrder = c.containers.length === c._count.containers;
        const share = everyMatchedLineHasAmount ? matchedTotal : claimIsFullyWithinThisOrder ? c.valueUsd : matchedTotal;
        return sum + share;
      }, 0)
  );
}

export default async function FinancialsPage() {
  const session = await auth();
  if (!canSeeFinancials(session?.user)) redirect("/");

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.orders;
  const logisticsDict = fullDict.logistics;
  const financialsDict = fullDict.financials;

  const COST_CATEGORY_LABEL: Record<string, string> = {
    DEMURRAGE: logisticsDict.costDemurrage,
    DETENTION: logisticsDict.costDetention,
    STORAGE: logisticsDict.costStorage,
    CUSTOMS_DELAY: logisticsDict.costCustomsDelay,
    DOCUMENTATION: logisticsDict.costDocumentation,
    INSPECTION: logisticsDict.costInspection,
    REROUTING: logisticsDict.costRerouting,
    OTHER: logisticsDict.costOther,
  };

  const orders = await prisma.order.findMany({
    include: { client: true, containers: true },
    orderBy: { orderDate: "desc" },
    take: 200,
  });
  const netValues = await Promise.all(orders.map(computeNetOrderValue));
  const totalOrderValue = orders.reduce((s, o) => s + o.valueUsd, 0);
  const totalNetOrderValue = netValues.reduce((s, v) => s + v, 0);

  const containers = await prisma.container.findMany({
    include: {
      order: { include: { client: true } },
      palletLines: { include: { pallet: true } },
      costs: { orderBy: { incurredAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const totalLogisticsCosts = containers.reduce((s, c) => s + c.costs.reduce((s2, x) => s2 + x.amountUsd, 0), 0);

  const [purchasingSpend, rawMaterialCost, packagingCost, wasteCost, laborCost, logisticsByCategory, claims, factories] =
    await Promise.all([
      getPurchasingSpendUsd(),
      getRawMaterialCostUsd(),
      getPackagingCostUsd(),
      getWasteCostUsd(),
      getLaborCostUsd(),
      getLogisticsCostByCategory(),
      prisma.claim.findMany({ include: { client: true }, orderBy: { claimDate: "desc" }, take: 200 }),
      prisma.factory.findMany({ select: { id: true, name: true, hourlyWageUsd: true }, orderBy: { name: "asc" } }),
    ]);

  const partialMargin =
    totalNetOrderValue - totalLogisticsCosts - purchasingSpend - rawMaterialCost - packagingCost - wasteCost - laborCost;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{financialsDict.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{financialsDict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.totalOrderValueLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${totalOrderValue.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.totalLogisticsCostsLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${totalLogisticsCosts.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.purchasingSpendLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${purchasingSpend.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.rawMaterialCostLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${rawMaterialCost.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.packagingCostLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${packagingCost.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.wasteCostLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${wasteCost.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{financialsDict.laborCostLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">${laborCost.toLocaleString()}</p>
        </Card>
      </div>
      <p className="text-xs text-slate-400">{financialsDict.costInputNote}</p>

      <Card className="border-emerald-200 bg-emerald-50">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">{financialsDict.partialMarginLabel}</p>
        <p className="mt-1 text-2xl font-semibold text-emerald-900">${partialMargin.toLocaleString()}</p>
        <p className="mt-1 text-xs text-emerald-700">{financialsDict.partialMarginNote}</p>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{financialsDict.logisticsByCategoryTitle}</h2>
          {logisticsByCategory.length > 0 ? (
            <dl className="mt-3 space-y-1 text-sm">
              {logisticsByCategory.map((row) => (
                <div key={row.category} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{COST_CATEGORY_LABEL[row.category] ?? row.category}</dt>
                  <dd className="text-end text-slate-800">${row.totalUsd.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-400">{financialsDict.noCostsYet}</p>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{financialsDict.laborSectionTitle}</h2>
          <p className="mt-1 text-xs text-slate-500">{financialsDict.laborSectionDescription}</p>
          <dl className="mt-3 space-y-1 text-sm">
            {factories.map((f) => (
              <div key={f.id} className="flex justify-between gap-4">
                <dt className="text-slate-500">{f.name}</dt>
                <dd className="text-end text-slate-800">
                  {f.hourlyWageUsd != null ? `$${f.hourlyWageUsd}/hr` : "—"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-slate-400">{financialsDict.laborCostFootnote}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{financialsDict.claimsSectionTitle}</h2>
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{financialsDict.colClaimClient}</th>
              <th className="px-4 py-2 font-medium">{financialsDict.colClaimReason}</th>
              <th className="px-4 py-2 font-medium">{financialsDict.colClaimAmount}</th>
              <th className="px-4 py-2 font-medium">{financialsDict.colClaimStatus}</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/claims/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                    {c.client.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{dict[CLAIM_REASON_LABEL_KEY[c.reason]]}</td>
                <td className="px-4 py-2">${c.valueUsd.toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Badge color={isCreditedClaim(c.status) ? "red" : "slate"}>{dict[CLAIM_STATUS_LABEL_KEY[c.status]]}</Badge>
                </td>
              </tr>
            ))}
            {claims.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  {financialsDict.noClaimsYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{financialsDict.ordersSectionTitle}</h2>
        </div>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colOrderNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.grossValueLabel}</th>
              <th className="px-4 py-2 font-medium">{dict.netValueLabel}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.client.name}</td>
                <td className="px-4 py-2">${o.valueUsd.toLocaleString()}</td>
                <td className="px-4 py-2">${netValues[i].toLocaleString()}</td>
                <td className="no-print px-4 py-2">
                  <form action={updateOrderValueAction.bind(null, o.id)} className="flex items-end gap-2">
                    <FieldGroup label={o.valueUsd > 0 ? dict.updateValueLabel : dict.setValueLabel}>
                      <Input name="valueUsd" type="number" step="0.01" min="0" defaultValue={o.valueUsd || ""} className="w-32" />
                    </FieldGroup>
                    <Button type="submit" variant="secondary" className="text-xs">
                      {dict.save}
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {financialsDict.noOrdersYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="p-0">
        <div className="px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{financialsDict.logisticsSectionTitle}</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {containers.map((c) => {
            const totalLoaded = c.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
            // A pallet's cartons can be split across two containers when it
            // fills one up mid-pallet, so a container's own carton count is
            // prorated by however much of each pallet's weight actually went
            // into it, not just summed whole.
            const totalCartons = c.palletLines.reduce((sum, line) => {
              if (!line.pallet.totalCartons || line.pallet.weightTonnes <= 0) return sum;
              const fraction = Math.min(1, line.quantityTonnes / line.pallet.weightTonnes);
              return sum + line.pallet.totalCartons * fraction;
            }, 0);
            const valueByWeightUsd = c.pricePerKgUsd != null ? c.pricePerKgUsd * totalLoaded * 1000 : null;
            const valueByCartonUsd = c.pricePerCartonUsd != null ? c.pricePerCartonUsd * totalCartons : null;
            const totalExtraCostsUsd = c.costs.reduce((s, x) => s + x.amountUsd, 0);

            return (
              <details key={c.id} className="p-4">
                <summary className="flex cursor-pointer items-center justify-between text-sm">
                  <span>
                    <span className="font-medium text-emerald-700">{c.containerNumber}</span>
                    <span className="ms-2 text-slate-500">
                      {c.order.client.name} · {c.order.orderNumber}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {valueByWeightUsd != null && (
                      <span className="text-slate-700">${valueByWeightUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    )}
                    {totalExtraCostsUsd > 0 && (
                      <Badge color="amber">
                        {logisticsDict.totalSuffix.replace(
                          "{amount}",
                          `$${totalExtraCostsUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        )}
                      </Badge>
                    )}
                  </span>
                </summary>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{logisticsDict.containerValueTitle}</h3>
                    <form action={updateContainerValueAction.bind(null, c.id)} className="no-print mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <FieldGroup label={logisticsDict.pricePerKgLabel}>
                          <Input name="pricePerKgUsd" type="number" step="0.001" min="0" defaultValue={c.pricePerKgUsd ?? ""} />
                        </FieldGroup>
                        <FieldGroup label={logisticsDict.pricePerCartonLabel}>
                          <Input name="pricePerCartonUsd" type="number" step="0.01" min="0" defaultValue={c.pricePerCartonUsd ?? ""} />
                        </FieldGroup>
                      </div>
                      <Button type="submit" variant="secondary">
                        {logisticsDict.save}
                      </Button>
                    </form>
                    <dl className="mt-3 space-y-1 text-sm">
                      <Row
                        label={logisticsDict.byWeightLabel.replace("{kg}", (totalLoaded * 1000).toFixed(0))}
                        value={valueByWeightUsd != null ? `$${valueByWeightUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                      />
                      <Row
                        label={logisticsDict.byCartonsLabel.replace("{ctn}", totalCartons.toFixed(0))}
                        value={valueByCartonUsd != null ? `$${valueByCartonUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : undefined}
                      />
                      <Row label={logisticsDict.paymentTermsLabel} value={c.order.client.paymentTerms} />
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{logisticsDict.additionalCostsTitle}</h3>
                    <p className="mt-1 text-xs text-slate-500">{logisticsDict.additionalCostsSubtitle}</p>
                    {c.costs.length > 0 && (
                      <ul className="mt-3 divide-y divide-slate-100 text-sm">
                        {c.costs.map((cost) => (
                          <li key={cost.id} className="flex items-center justify-between py-2">
                            <div>
                              <Badge color="slate">{COST_CATEGORY_LABEL[cost.category]}</Badge>
                              <span className="ms-2 text-slate-700">${cost.amountUsd.toLocaleString()}</span>
                              {cost.description && <span className="ms-2 text-slate-500">{cost.description}</span>}
                              <span className="ms-2 text-xs text-slate-400">{cost.incurredAt.toDateString()}</span>
                            </div>
                            <form action={removeContainerCostAction.bind(null, c.id, cost.id)} className="no-print">
                              <ConfirmSubmitButton
                                confirmMessage={logisticsDict.removeCostConfirm
                                  .replace("{amount}", `$${cost.amountUsd.toLocaleString()}`)
                                  .replace("{category}", COST_CATEGORY_LABEL[cost.category])}
                              >
                                {logisticsDict.remove}
                              </ConfirmSubmitButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="no-print mt-4 border-t border-slate-100 pt-4">
                      <AddCostForm containerId={c.id} />
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
          {containers.length === 0 && <p className="p-4 text-sm text-slate-400">{financialsDict.noContainersYet}</p>}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value || "—"}</dd>
    </div>
  );
}
