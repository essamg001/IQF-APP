import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";

export default async function LoadOutPage() {
  const orders = await prisma.order.findMany({
    where: { stage: { notIn: ["DELIVERED", "PAID"] } },
    include: { client: true, containers: true, _count: { select: { pallets: true } } },
    orderBy: { orderDate: "asc" },
  });

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Load Out</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every active order, ready for the logistics team to pick a transport day and send to load-out.
        </p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Order #</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Grade/Format</th>
              <th className="px-4 py-2 font-medium">Allocated</th>
              <th className="px-4 py-2 font-medium">Order Date</th>
              <th className="px-4 py-2 font-medium">Load-Out Status</th>
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
                  {o.poNumber && <p className="text-xs text-slate-400">PO {o.poNumber}</p>}
                </td>
                <td className="px-4 py-2">{o.client.name}</td>
                <td className="px-4 py-2">
                  Grade {o.grade} · {FORMAT_LABEL[o.format]}
                </td>
                <td className="px-4 py-2">
                  {o._count.pallets} / {o.quantityPallets}
                </td>
                <td className="px-4 py-2">{format(o.orderDate, "dd MMM yyyy")}</td>
                <td className="px-4 py-2">
                  {o.containers.length === 0 ? (
                    <Badge color="slate">Not yet assigned</Badge>
                  ) : (
                    <div className="space-y-1">
                      {o.containers.map((c) => (
                        <Link key={c.id} href={`/logistics/${c.id}`} className="block text-emerald-700 hover:underline">
                          {c.containerNumber}
                          {c.departureDate && ` — ${format(c.departureDate, "dd MMM yyyy")}`}
                        </Link>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <LinkButton href={`/logistics/new?orderId=${o.id}`} variant="secondary" className="text-xs">
                    {o.containers.length === 0 ? "Take to Load-Out" : "Add another container"}
                  </LinkButton>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No active orders — nothing waiting to go to load-out.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
