import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isPurchaseRequestMyTurn } from "@/lib/purchaseRequests";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

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

export default async function PurchaseRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
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

  const session = await auth();

  const now = new Date();
  const requests = await prisma.purchaseRequest.findMany({
    include: { factory: true, items: true, _count: { select: { photos: true } } },
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  // Same status+role logic the detail page uses to decide which action card
  // to show -- one shared predicate so this badge/filter and the detail
  // page never disagree about whose turn it is.
  const myTurnCount = requests.filter((r) => isPurchaseRequestMyTurn(r, session?.user)).length;
  const showingMine = mine === "1";
  const visibleRequests = showingMine ? requests.filter((r) => isPurchaseRequestMyTurn(r, session?.user)) : requests;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {dict.subtitle}
            {myTurnCount > 0 && (
              <span className="ms-2">
                <Link href="/purchase-requests?mine=1">
                  <Badge color="amber">
                    {myTurnCount} {dict.requiresMyAction}
                  </Badge>
                </Link>
              </span>
            )}
          </p>
          {showingMine && (
            <p className="mt-1 text-xs text-slate-400">
              {dict.showingMyActionOnly}{" "}
              <Link href="/purchase-requests" className="text-emerald-700 hover:underline">
                {dict.showAllRequests}
              </Link>
            </p>
          )}
          <p className="print-only mt-1 text-xs text-slate-500">
            {common.printedOn.replace("{date}", formatDate(now, "dd MMM yyyy HH:mm", locale))}
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <PrintButton />
          <LinkButton href="/purchase-requests/new">{dict.newRequest}</LinkButton>
        </div>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colTrackingNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colItem}</th>
              <th className="px-4 py-2 font-medium">{common.factory}</th>
              <th className="px-4 py-2 font-medium">{dict.colRequestedBy}</th>
              <th className="px-4 py-2 font-medium">{dict.requestedLabel}</th>
              <th className="px-4 py-2 font-medium">{dict.colExpectedDelivery}</th>
              <th className="px-4 py-2 font-medium">{common.status}</th>
            </tr>
          </thead>
          <tbody>
            {visibleRequests.map((r) => {
              return (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/purchase-requests/${r.id}`} className="font-medium text-emerald-700 hover:underline">
                      {r.trackingNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {r.items.map((i) => i.itemDescription).join(", ")}
                    {r._count.photos > 0 && (
                      <span className="ms-1.5 text-xs text-slate-400">
                        ({r._count.photos} {dict.photoCountSuffix})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{r.isJointOrder ? dict.jointOrderBadge : r.factory?.name}</td>
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
            {visibleRequests.length === 0 && (
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
