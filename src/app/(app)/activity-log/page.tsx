import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

const ACTION_LABEL: Record<string, string> = {
  CLAIM_CREATED: "Filed claim",
  CLAIM_STATUS_ADVANCED: "Advanced claim status",
  CLAIM_ATTACHMENT_UPLOADED: "Uploaded claim evidence",
  CLAIM_ATTACHMENT_REMOVED: "Removed claim evidence",
  QUALITY_CHECK_REJECTED: "Rejected out-of-spec quality check",
  QUALITY_OVERRIDE_APPROVED_AT_RISK: "Approved out-of-spec quality check at risk",
  PALLET_MARKED_WASTE: "Marked pallet as waste",
  USER_ADDED: "Added user",
  USER_DELETED: "Removed user",
  USER_HEAD_OF_SALES_TOGGLED: "Changed Head of Sales flag",
  COSTING_RATES_UPDATED: "Updated costing rates",
  CONTAINER_SHIPMENT_DETAILS_UPDATED: "Updated container shipment details",
  CONTAINER_LOCATION_UPDATED: "Updated container location",
  ORDER_CREATED: "Created order",
  ORDER_VALUE_UPDATED: "Updated order value",
  ORDER_PALLETS_ALLOCATED: "Allocated pallets to order",
  ORDER_STAGE_ADVANCED: "Advanced order stage",
};

function entityHref(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "Claim":
      return `/claims/${entityId}`;
    case "QualityCheck":
      return `/quality-check/${entityId}`;
    case "Container":
      return `/logistics/${entityId}`;
    case "Pallet":
      return `/storage/${entityId}`;
    case "Order":
      return `/orders/${entityId}`;
    default:
      return null;
  }
}

export default async function ActivityLogPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    redirect("/");
  }

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          Who did what, and when — every claim decision, quality override, waste write-off, user
          change, and shipment edit is recorded here so it&apos;s always traceable to a person.
        </p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Record</th>
              <th className="px-4 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const href = entityHref(log.entityType, log.entityId);
              return (
                <tr key={log.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {format(log.createdAt, "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-2">{log.actor?.name ?? "Unknown"}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[log.action] ?? log.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    {href ? (
                      <a href={href} className="text-emerald-700 hover:underline">
                        {log.entityType} {log.entityId.slice(0, 8)}
                      </a>
                    ) : (
                      `${log.entityType} ${log.entityId.slice(0, 8)}`
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{log.detail ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
