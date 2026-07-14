import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { StatCard } from "@/components/ui/card";
import { canSeePricing } from "@/lib/roles";

export default async function DashboardPage() {
  const session = await auth();
  const role = session?.user.role;

  const [clientCount, activeOrders, palletsInStorage, openClaims, unreadAlerts, pendingMicro] =
    await Promise.all([
      prisma.client.count(),
      prisma.order.count({ where: { stage: { notIn: ["DELIVERED", "PAID"] } } }),
      prisma.pallet.count({ where: { status: "IN_STORAGE" } }),
      prisma.claim.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW"] } } }),
      role ? prisma.alert.count({ where: { targetRole: role, status: "UNREAD" } }) : 0,
      prisma.microbiologyResult.count({ where: { status: "PENDING" } }),
    ]);

  let revenueHint: string | undefined;
  if (canSeePricing(role)) {
    const value = await prisma.order.aggregate({ _sum: { valueUsd: true } });
    revenueHint = `$${(value._sum.valueUsd ?? 0).toLocaleString()} total order value`;
  }

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
        <StatCard label="Your Unread Alerts" value={String(unreadAlerts)} />
      </div>
    </div>
  );
}
