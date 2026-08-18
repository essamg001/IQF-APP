import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { Format } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

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

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderNumber}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colClient}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colGradeFormat}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colAllocated}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderDate}</th>
              <th className="px-4 py-2 font-medium">{dict.colLoadOutStatus}</th>
              <th className="px-4 py-2 font-medium"></th>
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
                      {ordersDict.poPrefix} {o.poNumber}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2">{o.client.name}</td>
                <td className="px-4 py-2">
                  {ordersDict.gradeLabel.replace("{grade}", o.grade)} · {FORMAT_LABEL[o.format]}
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
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noActiveOrders}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
