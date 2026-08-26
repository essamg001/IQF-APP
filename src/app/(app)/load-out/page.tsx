import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { Format, OrderStage } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STAGE_COLOR = {
  CONFIRMED: "slate",
  IN_PRODUCTION: "amber",
  PACKED: "amber",
  SHIPPED: "blue",
} as const;

function stageLabel(dict: Dictionary["orders"], stage: keyof typeof STAGE_COLOR) {
  return {
    CONFIRMED: dict.stageConfirmed,
    IN_PRODUCTION: dict.stageInProduction,
    PACKED: dict.stagePacked,
    SHIPPED: dict.stageShipped,
  }[stage];
}

export default async function LoadOutPage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.loadOut;
  const ordersDict = fullDict.orders;
  const FORMAT_LABEL: Record<Format, string> = {
    WHOLE: ordersDict.formatWhole,
    SLICED: ordersDict.formatSliced,
    DICED: ordersDict.formatDiced,
  };

  const orders = await prisma.order.findMany({
    where: { stage: { notIn: ["DELIVERED", "PAID"] } },
    include: { client: true, containers: true, _count: { select: { pallets: true } } },
    orderBy: { orderDate: "asc" },
  });

  // The single most useful readiness signal isn't the order's own stage --
  // it's whether there's something for the logistics team to actually do:
  // either real pallets have been allocated (Pallet.orderId), or a
  // container already exists (someone already started tracking a shipment
  // for it, e.g. booked transport ahead of production -- see
  // createContainerAction, which has no pallet dependency). Only an order
  // with neither -- no stock, no container in motion -- is truly "nothing
  // to do yet", so that's the only thing tucked away below.
  const isReady = (o: (typeof orders)[number]) => o._count.pallets > 0 || o.containers.length > 0;
  const readyOrders = orders.filter(isReady);
  const notReadyOrders = orders.filter((o) => !isReady(o));

  // Within "ready": no container at all yet is the most urgent state (real
  // stock with zero shipping arranged) -- otherwise oldest order first.
  readyOrders.sort((a, b) => {
    const aUncontainered = a.containers.length === 0;
    const bUncontainered = b.containers.length === 0;
    if (aUncontainered !== bUncontainered) return aUncontainered ? -1 : 1;
    return a.orderDate.getTime() - b.orderDate.getTime();
  });

  const OrderRow = ({ o }: { o: (typeof orders)[number] }) => (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td className="px-4 py-2">
        <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
          {o.orderNumber}
        </Link>
        {o.poNumber && (
          <p className="text-xs text-slate-400">
            {ordersDict.poPrefix} {o.poNumber}
          </p>
        )}
      </td>
      <td className="px-4 py-2">{o.client.name}</td>
      <td className="px-4 py-2">
        {ordersDict.gradeLabel.replace("{grade}", o.grade)} · {FORMAT_LABEL[o.format]}
      </td>
      <td className="px-4 py-2">
        <Badge color={STAGE_COLOR[o.stage as keyof typeof STAGE_COLOR]}>
          {stageLabel(ordersDict, o.stage as keyof typeof STAGE_COLOR)}
        </Badge>
      </td>
      <td className="px-4 py-2">
        {o._count.pallets} / {o.quantityPallets}
      </td>
      <td className="px-4 py-2">{formatDate(o.orderDate, "dd MMM yyyy", locale)}</td>
      <td className="px-4 py-2">
        {o.containers.length === 0 ? (
          <Badge color="slate">{dict.notYetAssigned}</Badge>
        ) : (
          <div className="space-y-1">
            {o.containers.map((c) => (
              <Link key={c.id} href={`/logistics/${c.id}`} className="block text-emerald-700 hover:underline">
                {c.containerNumber}
                {c.departureDate && ` — ${formatDate(c.departureDate, "dd MMM yyyy", locale)}`}
              </Link>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        <LinkButton href={`/logistics/new?orderId=${o.id}`} variant="secondary" className="text-xs">
          {o.containers.length === 0 ? dict.takeToLoadOut : dict.addAnotherContainer}
        </LinkButton>
      </td>
    </tr>
  );

  const tableHead = (
    <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
      <tr>
        <th className="px-4 py-2 font-medium">{ordersDict.colOrderNumber}</th>
        <th className="px-4 py-2 font-medium">{ordersDict.colClient}</th>
        <th className="px-4 py-2 font-medium">{ordersDict.colGradeFormat}</th>
        <th className="px-4 py-2 font-medium">{dict.colStage}</th>
        <th className="px-4 py-2 font-medium">{ordersDict.colAllocated}</th>
        <th className="px-4 py-2 font-medium">{ordersDict.colOrderDate}</th>
        <th className="px-4 py-2 font-medium">{dict.colLoadOutStatus}</th>
        <th className="px-4 py-2 font-medium"></th>
      </tr>
    </thead>
  );

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">
        {dict.readyToLoadTitle} {readyOrders.length > 0 && <span className="font-normal text-slate-400">({readyOrders.length})</span>}
      </h2>
      <Card className="mt-2 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          {tableHead}
          <tbody>
            {readyOrders.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
            {readyOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {dict.noReadyOrders}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {notReadyOrders.length > 0 && (
        <details className="mt-6 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            {dict.awaitingProductionTitle.replace("{count}", String(notReadyOrders.length))}
          </summary>
          <Card className="mt-2 overflow-x-auto p-0">
            <table className="w-full text-start text-sm">
              {tableHead}
              <tbody>
                {notReadyOrders.map((o) => (
                  <OrderRow key={o.id} o={o} />
                ))}
              </tbody>
            </table>
          </Card>
        </details>
      )}

      {orders.length === 0 && <p className="mt-6 text-sm text-slate-400">{dict.noActiveOrders}</p>}
    </div>
  );
}
