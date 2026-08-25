import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { generateAlerts } from "@/lib/alerts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markAlertReadAction } from "./actions";
import { QualityOverrideActions } from "./quality-override-actions";
import { canSignSpecException } from "@/lib/roles";
import { formatDate } from "@/lib/dates";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { AlertType } from "@prisma/client";

// Severity is a property of the alert TYPE (what happened), independent of
// whether it's been read yet (that's a separate, freshness signal -- see the
// Status column below). Critical = an active compliance/food-safety breach
// or a blocked action; warning = worth watching but nothing has actually
// failed yet; everything else (e.g. a risk sign-off already on record) is
// informational.
const CRITICAL_ALERT_TYPES = new Set<AlertType>([
  "MICROBIOLOGY_LOAD_ATTEMPT",
  "MRL_LOAD_ATTEMPT",
  "SPEC_MISMATCH",
  "MICROBIOLOGY_REJECTED",
  "QUALITY_LIMIT_EXCEEDED",
  "SHIFT_ON_HOLD",
  "TEMPERATURE_EXCURSION",
  "SPRAY_RESTRICTION_BLOCKED",
  "BLADE_KNIFE_MISMATCH",
  "BLADE_KNIFE_DAMAGED",
  "SCALE_OUT_OF_TOLERANCE",
  "RODENT_DETECTED",
  "TOOL_INVENTORY_DISCREPANCY",
]);
const WARNING_ALERT_TYPES = new Set<AlertType>([
  "CONTAINER_OVERDUE",
  "LOW_STOCK",
  "MICROBIOLOGY_PENDING",
  "EARLY_WARNING",
  "GLOBALGAP_EXPIRING",
]);
function alertSeverityColor(type: AlertType): "red" | "amber" | "slate" {
  if (CRITICAL_ALERT_TYPES.has(type)) return "red";
  if (WARNING_ALERT_TYPES.has(type)) return "amber";
  return "slate";
}

export default async function AlertsPage() {
  await generateAlerts();

  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.alerts;
  const common = fullDict.common;

  const TYPE_LABEL = {
    SPEC_MISMATCH: dict.typeSpecMismatch,
    CONTAINER_OVERDUE: dict.typeContainerOverdue,
    LOW_STOCK: dict.typeLowStock,
    MICROBIOLOGY_PENDING: dict.typeMicrobiologyPending,
    MICROBIOLOGY_LOAD_ATTEMPT: dict.typeMicrobiologyLoadAttempt,
    MRL_LOAD_ATTEMPT: dict.typeMrlLoadAttempt,
    MICROBIOLOGY_REJECTED: dict.typeMicrobiologyRejected,
    QUALITY_LIMIT_EXCEEDED: dict.typeQualityLimitExceeded,
    QUALITY_OVERRIDE_APPROVED: dict.typeQualityOverrideApproved,
    EARLY_WARNING: dict.typeEarlyWarning,
    SHIFT_ON_HOLD: dict.typeShiftOnHold,
    TEMPERATURE_EXCURSION: dict.typeTemperatureExcursion,
    GLOBALGAP_EXPIRING: dict.typeGlobalgapExpiring,
    SPRAY_RESTRICTION_BLOCKED: dict.typeSprayRestrictionBlocked,
    BLADE_KNIFE_MISMATCH: dict.typeBladeKnifeMismatch,
    BLADE_KNIFE_DAMAGED: dict.typeBladeKnifeDamaged,
    SCALE_OUT_OF_TOLERANCE: dict.typeScaleOutOfTolerance,
    RODENT_DETECTED: dict.typeRodentDetected,
    TOOL_INVENTORY_DISCREPANCY: dict.typeToolInventoryDiscrepancy,
  } as const;

  const STATUS_LABEL = { UNREAD: dict.statusUnread, READ: dict.statusRead } as const;

  const session = await auth();
  const role = session!.user.role;
  const canOverride = canSignSpecException(session!.user);

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
      <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colType}</th>
              <th className="px-4 py-2 font-medium">{dict.colMessage}</th>
              <th className="px-4 py-2 font-medium">{dict.colRaised}</th>
              <th className="px-4 py-2 font-medium">{common.status}</th>
              <th className="px-4 py-2 font-medium">{dict.colDecision}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => {
              const check = a.type === "QUALITY_LIMIT_EXCEEDED" ? checkById.get(a.relatedEntityId!) : undefined;
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Badge color={alertSeverityColor(a.type)}>{TYPE_LABEL[a.type]}</Badge>
                  </td>
                  <td className="px-4 py-2">{a.message}</td>
                  <td className="px-4 py-2">{formatDate(a.createdAt, "dd MMM yyyy HH:mm", locale)}</td>
                  <td className="px-4 py-2">
                    <Badge color={a.status === "UNREAD" ? "blue" : "slate"}>{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    {check?.overrideStatus === "PENDING" && canOverride && <QualityOverrideActions checkId={check.id} />}
                    {check?.overrideStatus === "PENDING" && !canOverride && (
                      <span className="text-xs text-slate-400">{dict.ownerOrProductionOnly}</span>
                    )}
                    {check?.overrideStatus === "REJECTED" && (
                      <div>
                        <Badge color="red">{dict.rejected}</Badge>
                        <p className="mt-1 text-xs text-slate-500">{dict.rejectedBySuffix.replace("{name}", check.overrideByName ?? "")}</p>
                      </div>
                    )}
                    {check?.overrideStatus === "APPROVED_AT_RISK" && (
                      <div>
                        <Badge color="amber">{dict.approvedAtRisk}</Badge>
                        <p className="mt-1 text-xs text-slate-500">
                          {dict.signedBySuffix.replace("{name}", check.overrideByName ?? "")}
                          {check.overrideNote ? ` — ${check.overrideNote}` : ""}
                        </p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {a.status === "UNREAD" && !check && (
                      <form action={markAlertReadAction.bind(null, a.id)}>
                        <Button type="submit" variant="ghost" className="text-xs">
                          {dict.markRead}
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
                  {dict.noAlerts}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
