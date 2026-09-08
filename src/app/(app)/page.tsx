import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canManagePurchasing, canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

type OpenItemRow = { label: string; count: number; href: string };

function OpenItemsList({ rows, nothingLabel }: { rows: OpenItemRow[]; nothingLabel: string }) {
  const visible = rows.filter((r) => r.count > 0);
  if (visible.length === 0) return <p className="mt-3 text-sm text-slate-400">{nothingLabel}</p>;
  return (
    <ul className="mt-3 divide-y divide-slate-100">
      {visible.map((r) => (
        <li key={r.label} className="flex items-center justify-between py-2 text-sm">
          <Link href={r.href} className="text-slate-700 hover:underline">
            {r.label}
          </Link>
          <Badge color="amber">{r.count}</Badge>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role;
  const user = session?.user;
  const dict = getDictionary(await resolveLocale()).dashboard;

  const [
    clientCount,
    activeOrders,
    palletsInStorage,
    openClaims,
    unreadAlerts,
    pendingMicro,
    purchaseRequestsToReview,
    purchaseRequestsToOrder,
    purchaseRequestsAwaitingReceipt,
    purchaseRequestsAwaitingWorkingCheck,
    structuralIssuesToConfirm,
    structuralIssuesOverdue,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.order.count({ where: { stage: { notIn: ["DELIVERED", "PAID"] }, cancelledAt: null } }),
    prisma.pallet.count({ where: { status: "IN_STORAGE" } }),
    prisma.claim.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
    role ? prisma.alert.count({ where: { targetRole: role, status: "UNREAD" } }) : 0,
    prisma.microbiologyResult.count({ where: { status: { in: ["PENDING", "SENT_TO_LAB"] } } }),
    prisma.purchaseRequest.count({ where: { status: "REQUESTED" } }),
    prisma.purchaseRequest.count({ where: { status: "APPROVED" } }),
    prisma.purchaseRequest.count({ where: { status: "ORDERED" } }),
    prisma.purchaseRequest.count({ where: { status: "RECEIVED" } }),
    prisma.structuralIssue.count({ where: { status: "REPORTED" } }),
    prisma.structuralIssue.count({ where: { status: "PLANNED", proposedCompletionDate: { lt: new Date() } } }),
  ]);

  const purchasingRows: OpenItemRow[] = canManagePurchasing(user)
    ? [
        { label: dict.purchaseRequestsAwaitingReview, count: purchaseRequestsToReview, href: "/purchase-requests" },
        { label: dict.approvedRequestsReadyToOrder, count: purchaseRequestsToOrder, href: "/purchase-requests" },
      ]
    : [];
  if (canSignAsHeadOfProduction(user)) {
    purchasingRows.push({
      label: dict.ordersAwaitingReceiptConfirmation,
      count: purchaseRequestsAwaitingReceipt,
      href: "/purchase-requests",
    });
  }
  if (canManagePurchasing(user) || canSignAsHeadOfProduction(user)) {
    purchasingRows.push({
      label: dict.itemsAwaitingWorkingConfirmation,
      count: purchaseRequestsAwaitingWorkingCheck,
      href: "/purchase-requests",
    });
  }

  const structuralRows: OpenItemRow[] = [];
  if (canSignAsHeadOfMaintenance(user)) {
    structuralRows.push({
      label: dict.structuralIssuesAwaitingConfirmation,
      count: structuralIssuesToConfirm,
      href: "/structural-issues",
    });
  }
  if (role === "OWNER" || canSignAsHeadOfMaintenance(user) || canSignAsHeadOfProduction(user)) {
    structuralRows.push({
      label: dict.structuralIssuesOverdue,
      count: structuralIssuesOverdue,
      href: "/structural-issues",
    });
  }

  const alertRows: OpenItemRow[] = [{ label: dict.unreadAlerts, count: unreadAlerts, href: "/alerts" }];

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label={dict.statClients} value={String(clientCount)} />
        <StatCard label={dict.statActiveOrders} value={String(activeOrders)} />
        <StatCard label={dict.statPalletsInStorage} value={String(palletsInStorage)} />
        <StatCard label={dict.statOpenClaims} value={String(openClaims)} />
        <StatCard label={dict.statPendingMicrobiology} value={String(pendingMicro)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.alertsTitle}</h2>
          <OpenItemsList rows={alertRows} nothingLabel={dict.nothingNeedsAttention} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.purchasingTitle}</h2>
          <OpenItemsList rows={purchasingRows} nothingLabel={dict.nothingNeedsAttention} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.structuralIssuesTitle}</h2>
          <OpenItemsList rows={structuralRows} nothingLabel={dict.nothingNeedsAttention} />
        </Card>
      </div>
    </div>
  );
}
