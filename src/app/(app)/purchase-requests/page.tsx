import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManagePurchasing } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

const STATUS_COLOR = {
  REQUESTED: "amber",
  APPROVED: "blue",
  REJECTED: "red",
  ORDERED: "blue",
  RECEIVED: "green",
  CONFIRMED_WORKING: "green",
} as const;

const STATUS_LABEL = {
  REQUESTED: "Requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ORDERED: "Ordered",
  RECEIVED: "Received",
  CONFIRMED_WORKING: "Confirmed Working",
} as const;

const CATEGORY_LABEL = {
  CLEANING_MATERIALS: "Cleaning Materials",
  EQUIPMENT: "Equipment",
  SPARE_PARTS: "Spare Parts",
  OTHER: "Other",
} as const;

export default async function PurchaseRequestsPage() {
  const session = await auth();
  const canManage = canManagePurchasing(session?.user);

  const requests = await prisma.purchaseRequest.findMany({
    include: { factory: true, _count: { select: { photos: true } } },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  const pendingCount = requests.filter((r) => r.status === "REQUESTED").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Purchase Requests</h1>
          <p className="mt-1 text-sm text-slate-500">
            Anything the factory needs — cleaning materials, equipment, spare parts — tracked from request through
            to confirmed working.
            {pendingCount > 0 && canManage && (
              <span className="ml-2">
                <Badge color="amber">{pendingCount} awaiting review</Badge>
              </span>
            )}
          </p>
        </div>
        <LinkButton href="/purchase-requests/new">New Request</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Factory</th>
              <th className="px-4 py-2 font-medium">Requested By</th>
              <th className="px-4 py-2 font-medium">Requested</th>
              <th className="px-4 py-2 font-medium">Expected Delivery</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/purchase-requests/${r.id}`} className="font-medium text-emerald-700 hover:underline">
                    {r.itemDescription}
                  </Link>
                  {r._count.photos > 0 && <span className="ml-1.5 text-xs text-slate-400">({r._count.photos} photo{r._count.photos === 1 ? "" : "s"})</span>}
                </td>
                <td className="px-4 py-2 text-slate-600">{CATEGORY_LABEL[r.category]}</td>
                <td className="px-4 py-2 text-slate-600">{r.factory.name}</td>
                <td className="px-4 py-2 text-slate-600">{r.requestedByName}</td>
                <td className="px-4 py-2 text-slate-500">{format(r.requestedAt, "dd MMM yyyy")}</td>
                <td className="px-4 py-2 text-slate-500">
                  {r.expectedDeliveryDate ? format(r.expectedDeliveryDate, "dd MMM yyyy") : "—"}
                </td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No purchase requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
