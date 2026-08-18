import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input, FieldGroup } from "@/components/ui/field";
import { toggleQualityIssueStatusAction, updateCapaAction } from "../actions";
import { VerifyCapaForm } from "./verify-capa-form";
import { format } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function QualityIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const currentUserLabel = session?.user.name ?? session?.user.email ?? null;
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.qualityIssues;
  const REASON_LABEL: Record<string, string> = {
    QUALITY: fullDict.orders.claimReasonQuality,
    PACKAGING: fullDict.orders.claimReasonPackaging,
    FOREIGN_MATERIAL: fullDict.orders.claimReasonForeignMaterial,
    TRANSPORT: fullDict.orders.claimReasonTransport,
  };
  const STATUS_LABEL: Record<string, string> = {
    OPEN: dict.statusOpen,
    RESOLVED: dict.statusResolved,
  };

  const issue = await prisma.qualityIssue.findUnique({
    where: { id },
    include: {
      client: true,
      relatedOrder: true,
      relatedContainer: true,
      relatedLot: true,
    },
  });
  if (!issue) notFound();

  const resolvedReference = issue.relatedOrder
    ? { href: `/orders/${issue.relatedOrder.id}`, label: `${dict.orderRefLabel} ${issue.relatedOrder.orderNumber}` }
    : issue.relatedContainer
      ? { href: `/logistics/${issue.relatedContainer.id}`, label: `${dict.containerRefLabel} ${issue.relatedContainer.containerNumber}` }
      : issue.relatedLot
        ? { href: `/production/${issue.relatedLot.id}`, label: `${dict.lotRefLabel} ${issue.relatedLot.lotNumber}` }
        : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {dict.title} — {issue.client?.name ?? dict.internalLabel}
            </h1>
            <Badge color={issue.status === "OPEN" ? "amber" : "green"}>{STATUS_LABEL[issue.status] ?? issue.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {format(issue.issueDate, "dd MMM yyyy")} · {REASON_LABEL[issue.reason] ?? issue.reason}
            {issue.variety ? ` · ${issue.variety}` : ""}
          </p>
        </div>
        <form action={toggleQualityIssueStatusAction.bind(null, issue.id)}>
          <ConfirmSubmitButton
            confirmMessage={issue.status === "OPEN" ? dict.markResolvedConfirm : dict.reopenConfirm}
            className={
              issue.status === "OPEN"
                ? "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                : "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            }
          >
            {issue.status === "OPEN" ? dict.markResolved : dict.reopen}
          </ConfirmSubmitButton>
        </form>
      </div>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
          <dt className="text-sm text-slate-500">{dict.relatedReferenceLabel}</dt>
          <dd className="text-right text-sm font-medium">
            {resolvedReference ? (
              <a href={resolvedReference.href} className="text-emerald-700 hover:underline">
                {issue.relatedReference} → {resolvedReference.label}
              </a>
            ) : issue.relatedReference ? (
              <span className="text-red-600">
                {issue.relatedReference} {dict.notFoundSuffix}
              </span>
            ) : (
              <span className="text-slate-800">—</span>
            )}
          </dd>
        </div>
        <Row label={dict.whatHappenedFieldLabel} value={issue.issueDetails} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">{dict.rootCauseTitle}</h2>
        <form action={updateCapaAction.bind(null, issue.id)} className="space-y-3">
          <FieldGroup label={dict.rootCauseLabel}>
            <Input name="rootCause" defaultValue={issue.rootCause ?? ""} placeholder={dict.rootCausePlaceholder} />
          </FieldGroup>
          <FieldGroup label={dict.correctiveActionLabel}>
            <Input name="correctiveAction" defaultValue={issue.correctiveAction ?? ""} placeholder={dict.correctiveActionFieldPlaceholder} />
          </FieldGroup>
          <Button type="submit">{dict.save}</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{dict.verificationTitle}</h2>
        <p className="text-xs text-slate-500">{dict.verificationSubtitle}</p>
        {issue.verifiedByName ? (
          <div className="text-sm">
            <p className="text-slate-800">
              {issue.verifiedByName}
              <span className="ms-2 text-xs text-slate-500">{issue.verifiedAt?.toLocaleString()}</span>
            </p>
            {issue.verificationNotes && <p className="mt-1 text-xs text-slate-500">{issue.verificationNotes}</p>}
          </div>
        ) : !issue.rootCause?.trim() || !issue.correctiveAction?.trim() ? (
          <p className="text-xs text-slate-400">{dict.fillInBeforeVerifying}</p>
        ) : (
          <VerifyCapaForm issueId={issue.id} currentUserLabel={currentUserLabel} />
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}
