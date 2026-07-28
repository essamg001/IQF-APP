import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateAlerts } from "@/lib/alerts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAlertReadAction } from "./actions";
import { QualityOverrideActions } from "./quality-override-actions";
import { format } from "date-fns";

const TYPE_LABEL = {
  SPEC_MISMATCH: "Spec Mismatch",
  CONTAINER_OVERDUE: "Container Overdue",
  LOW_STOCK: "Low Stock",
  MICROBIOLOGY_PENDING: "Microbiology Pending",
  MICROBIOLOGY_LOAD_ATTEMPT: "Blocked Load Attempt",
  MICROBIOLOGY_REJECTED: "Lab Rejection",
  QUALITY_LIMIT_EXCEEDED: "Quality Limit Exceeded",
} as const;

export default async function AlertsPage() {
  await generateAlerts();

  const session = await auth();
  const role = session!.user.role;

  const alerts = await prisma.alert.findMany({
    where: { targetRole: role },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const checkIds = alerts.filter((a) => a.type === "QUALITY_LIMIT_EXCEEDED").map((a) => a.relatedEntityId!);
  const checks = checkIds.length
    ? await prisma.qualityCheck.findMany({ where: { id: { in: checkIds } } })
    : [];
  const checkById = new Map(checks.map((c) => [c.id, c]));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Alerts</h1>
      <p className="mt-1 text-sm text-slate-500">
        Automatically flags spec mismatches, overdue containers, low stock, pending microbiology, and out-of-spec
        quality checks — checked in-app and emailed.
      </p>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Message</th>
              <th className="px-4 py-2 font-medium">Raised</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Decision</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => {
              const check = a.type === "QUALITY_LIMIT_EXCEEDED" ? checkById.get(a.relatedEntityId!) : undefined;
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Badge color={a.status === "UNREAD" ? "amber" : "slate"}>{TYPE_LABEL[a.type]}</Badge>
                  </td>
                  <td className="px-4 py-2">{a.message}</td>
                  <td className="px-4 py-2">{format(a.createdAt, "dd MMM yyyy HH:mm")}</td>
                  <td className="px-4 py-2">{a.status}</td>
                  <td className="px-4 py-2">
                    {check?.overrideStatus === "PENDING" && <QualityOverrideActions checkId={check.id} />}
                    {check?.overrideStatus === "REJECTED" && (
                      <div>
                        <Badge color="red">Rejected</Badge>
                        <p className="mt-1 text-xs text-slate-500">by {check.overrideByName}</p>
                      </div>
                    )}
                    {check?.overrideStatus === "APPROVED_AT_RISK" && (
                      <div>
                        <Badge color="amber">Approved at Risk</Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          Signed by {check.overrideByName}
                          {check.overrideNote ? ` — ${check.overrideNote}` : ""}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.status === "UNREAD" && !check && (
                      <form action={markAlertReadAction.bind(null, a.id)}>
                        <Button type="submit" variant="ghost" className="text-xs">
                          Mark read
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No alerts for your role right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
