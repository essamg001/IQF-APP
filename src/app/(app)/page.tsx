import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canSeePricing, canManagePurchasing, canSignAsHeadOfProduction, canSignAsHeadOfMaintenance } from "@/lib/roles";

type OpenItemRow = { label: string; count: number; href: string };

function OpenItemsList({ rows }: { rows: OpenItemRow[] }) {
  const visible = rows.filter((r) => r.count > 0);
  if (visible.length === 0) return <p className="mt-3 text-sm text-slate-400">Nothing needs your attention.</p>;
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
    prisma.order.count({ where: { stage: { notIn: ["DELIVERED", "PAID"] } } }),
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

  let revenueHint: string | undefined;
  if (canSeePricing(role)) {
    const value = await prisma.order.aggregate({ _sum: { valueUsd: true } });
    revenueHint = `$${(value._sum.valueUsd ?? 0).toLocaleString()} total order value`;
  }

  const purchasingRows: OpenItemRow[] = canManagePurchasing(user)
    ? [
        { label: "Purchase requests awaiting your review", count: purchaseRequestsToReview, href: "/purchase-requests" },
        { label: "Approved requests ready to order", count: purchaseRequestsToOrder, href: "/purchase-requests" },
      ]
    : [];
  if (canSignAsHeadOfProduction(user)) {
    purchasingRows.push({
      label: "Orders awaiting receipt confirmation",
      count: purchaseRequestsAwaitingReceipt,
      href: "/purchase-requests",
    });
  }
  if (canManagePurchasing(user) || canSignAsHeadOfProduction(user)) {
    purchasingRows.push({
      label: "Items awaiting working confirmation",
      count: purchaseRequestsAwaitingWorkingCheck,
      href: "/purchase-requests",
    });
  }

  const structuralRows: OpenItemRow[] = [];
  if (canSignAsHeadOfMaintenance(user)) {
    structuralRows.push({
      label: "Structural issues awaiting your confirmation",
      count: structuralIssuesToConfirm,
      href: "/structural-issues",
    });
  }
  if (role === "OWNER" || canSignAsHeadOfMaintenance(user) || canSignAsHeadOfProduction(user)) {
    structuralRows.push({
      label: "Structural issues overdue on their repair plan",
      count: structuralIssuesOverdue,
      href: "/structural-issues",
    });
  }

  const alertRows: OpenItemRow[] = [{ label: "Unread alerts", count: unreadAlerts, href: "/alerts" }];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">Overview across clients, production, storage, and logistics.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Clients" value={String(clientCount)} hint={revenueHint} />
        <StatCard label="Active Orders" value={String(activeOrders)} />
        <StatCard label="Pallets in Storage" value={String(palletsInStorage)} />
        <StatCard label="Open Claims" value={String(openClaims)} />
        <StatCard label="Pending Microbiology" value={String(pendingMicro)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Alerts</h2>
          <OpenItemsList rows={alertRows} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Purchasing</h2>
          <OpenItemsList rows={purchasingRows} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Structural Issues</h2>
          <OpenItemsList rows={structuralRows} />
        </Card>
      </div>
    </div>
  );
}
