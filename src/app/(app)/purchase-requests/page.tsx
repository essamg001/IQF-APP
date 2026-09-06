import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManagePurchasing, canApproveAccounting } from "@/lib/roles";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const STATUS_COLOR = {
  REQUESTED: "amber",
  FORWARDED_TO_ACCOUNTING: "amber",
  FULFILLED_FROM_WAREHOUSE: "blue",
  APPROVED: "blue",
  REJECTED: "red",
  ORDERED: "blue",
  RECEIVED: "green",
  CONFIRMED_WORKING: "green",
} as const;

export default async function PurchaseRequestsPage() {
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.purchaseRequests;
  const common = fullDict.common;

  const STATUS_LABEL = {
    REQUESTED: dict.statusRequested,
    FORWARDED_TO_ACCOUNTING: dict.statusForwardedToAccounting,
    FULFILLED_FROM_WAREHOUSE: dict.statusFulfilledFromWarehouse,
    APPROVED: dict.statusApproved,
    REJECTED: dict.statusRejected,
    ORDERED: dict.statusOrdered,
    RECEIVED: dict.statusReceived,
    CONFIRMED_WORKING: dict.statusConfirmedWorking,
  } as const;

  const CATEGORY_LABEL = {
    CLEANING_MATERIALS: dict.categoryCleaningMaterials,
    EQUIPMENT: dict.categoryEquipment,
    SPARE_PARTS: dict.categorySpareParts,
    OTHER: common.other,
  } as const;

  const session = await auth();
  const canManage = canManagePurchasing(session?.user);
  const canApproveAcct = canApproveAccounting(session?.user);

  const requests = await prisma.purchaseRequest.findMany({
    include: { factory: true, items: true, _count: { select: { photos: true } } },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  // The warehouse forwards straight to Accounting now, not Purchasing --
  // Accounting's queue is anything awaiting their approve/reject decision;
  // Purchasing's queue only starts once Accounting has approved (status
  // APPROVED), whether or not they've acknowledged receipt yet.
  const pendingAccountingCount = requests.filter((r) => r.status === "FORWARDED_TO_ACCOUNTING").length;
  const pendingCount = requests.filter((r) => r.status === "APPROVED").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle}
            {pendingAccountingCount > 0 && canApproveAcct && (
              <span className="ms-2">
                <Badge color="amber">
                  {pendingAccountingCount} {dict.awaitingReview}
                </Badge>
              </span>
            )}
            {pendingCount > 0 && canManage && (
              <span className="ms-2">
                <Badge color="amber">
                  {pendingCount} {dict.awaitingReview}
                </Badge>
              </span>
            )}
          </p>
        </div>
        <LinkButton href="/purchase-requests/new">{dict.newRequest}</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colItem}</th>
              <th className="px-4 py-2 font-medium">{dict.colCategory}</th>
              <th className="px-4 py-2 font-medium">{common.factory}</th>
              <th className="px-4 py-2 font-medium">{dict.colRequestedBy}</th>
              <th className="px-4 py-2 font-medium">{dict.requestedLabel}</th>
              <th className="px-4 py-2 font-medium">{dict.colExpectedDelivery}</th>
              <th className="px-4 py-2 font-medium">{common.status}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const distinctCategories = [...new Set(r.items.map((i) => i.category))];
              const categoryLabel =
                distinctCategories.length === 1 ? CATEGORY_LABEL[distinctCategories[0]] : dict.categoryMixed;
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/purchase-requests/${r.id}`} className="font-medium text-emerald-700 hover:underline">
                      {r.items.map((i) => i.itemDescription).join(", ")}
                    </Link>
                    {r._count.photos > 0 && (
                      <span className="ms-1.5 text-xs text-slate-400">
                        ({r._count.photos} {dict.photoCountSuffix})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{categoryLabel}</td>
                  <td className="px-4 py-2 text-slate-600">{r.factory.name}</td>
                  <td className="px-4 py-2 text-slate-600">{r.requestedByName}</td>
                  <td className="px-4 py-2 text-slate-500">{formatDate(r.requestedAt, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {r.expectedDeliveryDate ? formatDate(r.expectedDeliveryDate, "dd MMM yyyy", locale) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={STATUS_COLOR[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  {dict.noRequests}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
