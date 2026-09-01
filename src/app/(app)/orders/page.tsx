import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { getOrderLifecycleStatus, summarizeLifecycle, type LifecycleStepKey } from "@/lib/orderLifecycle";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STAGE_COLOR = {
  CONFIRMED: "slate",
  IN_PRODUCTION: "amber",
  PACKED: "amber",
  SHIPPED: "blue",
  DELIVERED: "green",
  PAID: "green",
} as const;

function formatLabel(dict: Dictionary["orders"], format: "WHOLE" | "SLICED" | "DICED") {
  return { WHOLE: dict.formatWhole, SLICED: dict.formatSliced, DICED: dict.formatDiced }[format];
}

function stageLabel(dict: Dictionary["orders"], stage: keyof typeof STAGE_COLOR) {
  return {
    CONFIRMED: dict.stageConfirmed,
    IN_PRODUCTION: dict.stageInProduction,
    PACKED: dict.stagePacked,
    SHIPPED: dict.stageShipped,
    DELIVERED: dict.stageDelivered,
    PAID: dict.stagePaid,
  }[stage];
}

function stepLabel(dict: Dictionary["orders"], key: LifecycleStepKey) {
  return {
    CONFIRMED: dict.stageConfirmed,
    ALLOCATED: dict.stepAllocated,
    LAB_CLEARED: dict.stepLabCleared,
    LOADED: dict.stepLoaded,
    SHIPPED: dict.stageShipped,
    DELIVERED: dict.stageDelivered,
    PAID: dict.stagePaid,
  }[key];
}

export default async function OrdersPage() {
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);
  const locale = await resolveLocale();
  const dict = getDictionary(locale).orders;

  const orders = await prisma.order.findMany({
    include: {
      client: { include: { specs: true } },
      containers: true,
      _count: { select: { pallets: true } },
      // Only fetched in full for orders whose stage isn't already terminal --
      // a Delivered/Paid order has nothing left to derive a blocker for.
      pallets: {
        include: { lot: { include: { microbiologyResults: true, mrlResult: true, shift: true } } },
      },
    },
    orderBy: { orderDate: "desc" },
    take: 200,
  });

  const lifecycleByOrder = new Map<string, Awaited<ReturnType<typeof getOrderLifecycleStatus>>>();
  for (const o of orders) {
    if (o.stage === "DELIVERED" || o.stage === "PAID") continue;
    lifecycleByOrder.set(o.id, await getOrderLifecycleStatus(o));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {orders.length} {dict.orderCountSuffix}
          </p>
        </div>
        <LinkButton href="/orders/new">{dict.newOrder}</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colOrderNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.colGradeFormat}</th>
              <th className="px-4 py-2 font-medium">{dict.colQtyPallets}</th>
              <th className="px-4 py-2 font-medium">{dict.colAllocated}</th>
              {showPricing && <th className="px-4 py-2 font-medium">{dict.colValue}</th>}
              <th className="px-4 py-2 font-medium">{dict.colStage}</th>
              <th className="px-4 py-2 font-medium">{dict.colOrderDate}</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                  {o.poNumber && (
                    <p className="text-xs text-slate-400">
                      {dict.poPrefix} {o.poNumber}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2">{o.client.name}</td>
                <td className="px-4 py-2">
                  {dict.gradeLabel.replace("{grade}", o.grade)} · {formatLabel(dict, o.format)}
                </td>
                <td className="px-4 py-2">{o.quantityPallets}</td>
                <td className="px-4 py-2">{o._count.pallets} / {o.quantityPallets}</td>
                {showPricing && <td className="px-4 py-2">${o.valueUsd.toLocaleString()}</td>}
                <td className="px-4 py-2">
                  {(() => {
                    const steps = lifecycleByOrder.get(o.id);
                    if (!steps) return <Badge color={STAGE_COLOR[o.stage]}>{stageLabel(dict, o.stage)}</Badge>;
                    const summary = summarizeLifecycle(steps);
                    return (
                      <Badge color={summary.tone === "blocked" ? "amber" : summary.tone === "done" ? "green" : "blue"}>
                        {stepLabel(dict, summary.key)}
                      </Badge>
                    );
                  })()}
                </td>
                <td className="px-4 py-2">{formatDate(o.orderDate, "dd MMM yyyy", locale)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noOrdersYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
