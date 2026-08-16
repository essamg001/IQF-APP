import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";

const ACTION_LABEL: Record<string, string> = {
  ALERT_MARKED_READ: "Marked alert as read",
  CERTIFICATE_APPROVED: "Approved certificate of quality",
  CHLORINE_DOSING_CHECK_LOGGED: "Logged chlorine dosing check",
  CLAIM_CREATED: "Filed claim",
  CLAIM_STATUS_ADVANCED: "Advanced claim status",
  CLAIM_ATTACHMENT_UPLOADED: "Uploaded claim evidence",
  CLAIM_ATTACHMENT_REMOVED: "Removed claim evidence",
  CLEANING_PRODUCTION_SIGNED: "Signed cleaning record (Head of Production)",
  CLEANING_MAINTENANCE_SIGNED: "Signed cleaning record (Head of Maintenance)",
  CLEANING_RECORD_REOPENED: "Reopened locked cleaning record",
  CLEANING_SCHEDULE_TASK_COMPLETED: "Checked off cleaning schedule task",
  CLEANING_SCHEDULE_TASK_UNCHECKED: "Unchecked cleaning schedule task",
  CONTAINER_CHECKLIST_ITEM_CONFIRMED: "Confirmed pre-departure checklist item",
  CONTAINER_LOAD_PHOTO_UPLOADED: "Uploaded container load photo",
  CONTAINER_LOAD_PHOTO_REMOVED: "Removed container load photo",
  CONTAINER_LOCATION_UPDATED: "Updated container location",
  CONTAINER_MANIFEST_REOPENED: "Reopened locked container manifest",
  CONTAINER_SHIPMENT_DETAILS_UPDATED: "Updated container shipment details",
  FARM_ACCREDITATION_UPDATED: "Updated farm accreditation",
  LAB_DISPATCHED: "Sent sample to lab",
  LAB_RESULT_RECORDED: "Recorded lab result",
  LAUNDRY_RECORD_LOGGED: "Logged laundry entry",
  LAUNDRY_SUPERVISOR_SIGNED: "Signed laundry record (Supervisor)",
  LAUNDRY_VERIFIED_SIGNED: "Signed laundry record (Verifier)",
  LAUNDRY_SIGN_OFF_REOPENED: "Reopened locked laundry sign-off",
  LAUNDRY_WASH_CYCLE_LOGGED: "Logged laundry wash cycle",
  LOAD_OUT_SIGNED: "Signed off load-out",
  METAL_DETECTOR_CHECK_LOGGED: "Logged metal detector check",
  METAL_DETECTOR_MAINTENANCE_CHECKED: "Logged metal detector maintenance check",
  METAL_DETECTOR_MAINTENANCE_REOPENED: "Reopened locked metal detector maintenance checklist",
  MRL_DISPATCHED: "Sent MRL sample to lab",
  MRL_RESULT_RECORDED: "Recorded MRL result",
  ORDER_CREATED: "Created order",
  ORDER_VALUE_UPDATED: "Updated order value",
  ORDER_QUANTITY_UPDATED: "Corrected order quantity",
  ORDER_PALLETS_ALLOCATED: "Allocated pallets to order",
  ORDER_STAGE_ADVANCED: "Advanced order stage",
  PALLET_MARKED_WASTE: "Marked pallet as waste",
  PALLET_SLOT_ASSIGNED: "Assigned pallet to storage slot",
  PALLET_SLOT_UNASSIGNED: "Unassigned pallet from storage slot",
  QUALITY_CHECK_REJECTED: "Rejected out-of-spec quality check",
  QUALITY_ISSUE_CREATED: "Filed quality issue",
  QUALITY_ISSUE_CAPA_UPDATED: "Updated root cause / corrective action",
  QUALITY_ISSUE_STATUS_TOGGLED: "Changed quality issue status",
  QUALITY_OVERRIDE_APPROVED_AT_RISK: "Approved out-of-spec quality check at risk",
  QUALITY_SIGNED: "Signed off load-out (Quality Department)",
  SHIFT_HOLD_RESOLVED: "Resolved shift hold",
  SPEC_EXCEPTION_APPROVED: "Signed off out-of-spec load",
  STAFF_TRAINING_RECORDED: "Recorded staff training",
  USER_ADDED: "Added user",
  USER_DELETED: "Removed user",
  USER_HEAD_OF_SALES_TOGGLED: "Changed Head of Sales flag",
  USER_HEAD_OF_PRODUCTION_TOGGLED: "Changed Head of Production flag",
  USER_HEAD_OF_MAINTENANCE_TOGGLED: "Changed Head of Maintenance flag",
  USER_HEAD_OF_PURCHASING_TOGGLED: "Changed Head of Purchasing flag",
  PURCHASE_REQUEST_CREATED: "Submitted purchase request",
  PURCHASE_REQUEST_APPROVED: "Approved purchase request",
  PURCHASE_REQUEST_REJECTED: "Rejected purchase request",
  PURCHASE_REQUEST_ORDERED: "Marked purchase request as ordered",
  PURCHASE_REQUEST_RECEIVED: "Confirmed purchase request received",
  PURCHASE_REQUEST_CONFIRMED_WORKING: "Confirmed purchase request working",
  PURCHASE_REQUEST_PHOTO_UPLOADED: "Uploaded purchase request photo",
  PURCHASE_REQUEST_PHOTO_REMOVED: "Removed purchase request photo",
  STRUCTURAL_ISSUE_REPORTED: "Reported structural issue",
  STRUCTURAL_ISSUE_PLANNED: "Confirmed structural issue & proposed repair plan",
  STRUCTURAL_ISSUE_COMPLETED: "Marked structural issue completed",
  STRUCTURAL_ISSUE_PHOTO_UPLOADED: "Uploaded structural issue photo",
  STRUCTURAL_ISSUE_PHOTO_REMOVED: "Removed structural issue photo",
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
