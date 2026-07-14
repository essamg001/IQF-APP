import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canSeePricing } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";

const STAGE_COLOR = {
  CONFIRMED: "slate",
  IN_PRODUCTION: "amber",
  PACKED: "amber",
  SHIPPED: "blue",
  DELIVERED: "green",
  PAID: "green",
} as const;

export default async function OrdersPage() {
  const session = await auth();
  const showPricing = canSeePricing(session?.user.role);

  const orders = await prisma.order.findMany({
    include: { client: true, _count: { select: { pallets: true } } },
    orderBy: { orderDate: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">{orders.length} order(s).</p>
        </div>
        <LinkButton href="/orders/new">New Order</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Order #</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Grade/Format</th>
              <th className="px-4 py-2 font-medium">Qty (pallets)</th>
              <th className="px-4 py-2 font-medium">Allocated</th>
              {showPricing && <th className="px-4 py-2 font-medium">Value</th>}
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Order Date</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{o.client.name}</td>
                <td className="px-4 py-2">
                  Grade {o.grade} · {FORMAT_LABEL[o.format]}
                </td>
                <td className="px-4 py-2">{o.quantityPallets}</td>
                <td className="px-4 py-2">{o._count.pallets} / {o.quantityPallets}</td>
                {showPricing && <td className="px-4 py-2">${o.valueUsd.toLocaleString()}</td>}
                <td className="px-4 py-2">
                  <Badge color={STAGE_COLOR[o.stage]}>{o.stage.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2">{format(o.orderDate, "dd MMM yyyy")}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
