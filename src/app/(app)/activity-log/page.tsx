import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

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

function entityTypeLabel(dict: Dictionary["activityLog"], entityType: string): string {
  return (
    ({
      Claim: dict.entityClaim,
      QualityCheck: dict.entityQualityCheck,
      Container: dict.entityContainer,
      Pallet: dict.entityPallet,
      Order: dict.entityOrder,
    } as Record<string, string>)[entityType] ?? entityType
  );
}

export default async function ActivityLogPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    redirect("/");
  }

  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.activityLog;
  const ACTION_LABEL: Record<string, string> = dict.actionLabels;

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { actor: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colWhen}</th>
              <th className="px-4 py-2 font-medium">{dict.colWho}</th>
              <th className="px-4 py-2 font-medium">{dict.colAction}</th>
              <th className="px-4 py-2 font-medium">{dict.colRecord}</th>
              <th className="px-4 py-2 font-medium">{dict.colDetail}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const href = entityHref(log.entityType, log.entityId);
              const recordLabel = `${entityTypeLabel(dict, log.entityType)} ${log.entityId.slice(0, 8)}`;
              return (
                <tr key={log.id} className="border-b border-slate-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {format(log.createdAt, "dd MMM yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-2">{log.actor?.name ?? fullDict.common.unknown}</td>
                  <td className="px-4 py-2">{ACTION_LABEL[log.action] ?? log.action.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2">
                    {href ? (
                      <a href={href} className="text-emerald-700 hover:underline">
                        {recordLabel}
                      </a>
                    ) : (
                      recordLabel
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{log.detail ?? "—"}</td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noActivityYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
