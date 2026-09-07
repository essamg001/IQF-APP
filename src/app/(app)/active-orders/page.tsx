import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import type { Format } from "@prisma/client";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

const STAGE_COLOR = {
  CONFIRMED: "slate",
  IN_PRODUCTION: "amber",
  PACKED: "amber",
  SHIPPED: "blue",
} as const;

export default async function ActiveOrdersPage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.activeOrders;
  const ordersDict = fullDict.orders;
  const FORMAT_LABEL: Record<Format, string> = {
    WHOLE: ordersDict.formatWhole,
    SLICED: ordersDict.formatSliced,
    DICED: ordersDict.formatDiced,
  };
  const STAGE_LABEL: Record<keyof typeof STAGE_COLOR, string> = {
    CONFIRMED: ordersDict.stageConfirmed,
    IN_PRODUCTION: ordersDict.stageInProduction,
    PACKED: ordersDict.stagePacked,
    SHIPPED: ordersDict.stageShipped,
  };

  const orders = await prisma.order.findMany({
    where: { stage: { notIn: ["DELIVERED", "PAID"] } },
    include: { client: true, _count: { select: { pallets: true } } },
    orderBy: { orderDate: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{fullDict.nav.activeOrders}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle.replace("{count}", String(orders.length))}</p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton />
          <LinkButton href="/orders" variant="secondary" className="no-print">
            {dict.allOrders}
          </LinkButton>
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderNumber}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colClient}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colGradeFormat}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colQtyPallets}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colAllocated}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colStage}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderDate}</th>
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
                <td className="px-4 py-2">{o.quantityPallets}</td>
                <td className="px-4 py-2">
                  {o._count.pallets} / {o.quantityPallets}
                </td>
                <td className="px-4 py-2">
                  <Badge color={STAGE_COLOR[o.stage as keyof typeof STAGE_COLOR]}>
                    {STAGE_LABEL[o.stage as keyof typeof STAGE_COLOR]}
                  </Badge>
                </td>
                <td className="px-4 py-2">{formatDate(o.orderDate, "dd MMM yyyy", locale)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noneActive}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
