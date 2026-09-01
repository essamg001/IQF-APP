import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { formatDate } from "@/lib/dates";
import { canSignAsHeadOfMaintenance } from "@/lib/roles";
import { isStructuralIssueOverdue } from "@/lib/structuralIssues";
import { addStructuralIssuePhotoAction, removeStructuralIssuePhotoAction, acknowledgeStructuralIssueAction } from "../actions";
import { PlanForm } from "./plan-form";
import { CompleteForm } from "./complete-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const STATUS_COLOR = {
  REPORTED: "amber",
  PLANNED: "blue",
  COMPLETED: "green",
} as const;

function translateRepairPlan(plan: string, dict: ReturnType<typeof getDictionary>["structuralIssues"], locale: "EN" | "AR") {
  const match = plan.match(new RegExp(dict.repairPeriodPattern));
  if (!match) return plan;
  const [, from, to] = match;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return plan;
  return dict.repairPeriodLabel
    .replace("{from}", formatDate(fromDate, "dd MMM yyyy", locale))
    .replace("{to}", formatDate(toDate, "dd MMM yyyy", locale));
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end text-slate-800">{value}</dd>
    </div>
  );
}

export default async function StructuralIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveLocale();
  const dict = getDictionary(locale).structuralIssues;
  const common = getDictionary(locale).common;
  const STATUS_LABEL = {
    REPORTED: dict.statusReported,
    PLANNED: dict.statusPlanned,
    COMPLETED: dict.statusCompleted,
  } as const;

  const [session, issue] = await Promise.all([
    auth(),
    prisma.structuralIssue.findUnique({
      where: { id },
      include: { factory: true, photos: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } } },
    }),
  ]);
  if (!issue) notFound();

  const canManage = canSignAsHeadOfMaintenance(session?.user);
  const overdue = isStructuralIssueOverdue(issue);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-slate-900">
          {dict.locationOptionLabels[issue.location] ?? dict.knownLocationLabels[issue.location] ?? issue.location}
        </h1>
        <Badge color={STATUS_COLOR[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
        {overdue && <Badge color="red">{dict.overdueBadge}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.reportCard}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={common.factory} value={issue.factory.name} />
            <Row label={common.description} value={dict.knownDescriptionLabels[issue.description] ?? issue.description} />
            <Row label={dict.reportedBy} value={dict.knownReporterLabels[issue.reportedByName] ?? issue.reportedByName} />
            <Row label={dict.colReported} value={formatDate(issue.reportedAt, "dd MMM yyyy HH:mm", locale)} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.maintenanceCard}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label={dict.acknowledgedBy} value={issue.acknowledgedByName ? dict.knownPersonLabels[issue.acknowledgedByName] ?? issue.acknowledgedByName : null} />
            <Row
              label={dict.acknowledgedAt}
              value={issue.acknowledgedAt ? formatDate(issue.acknowledgedAt, "dd MMM yyyy HH:mm", locale) : null}
            />
            <Row label={dict.confirmedBy} value={issue.confirmedByName ? dict.knownPersonLabels[issue.confirmedByName] ?? issue.confirmedByName : null} />
            <Row
              label={dict.confirmedAt}
              value={issue.confirmedAt ? formatDate(issue.confirmedAt, "dd MMM yyyy HH:mm", locale) : null}
            />
            <Row label={dict.repairPlan} value={issue.proposedPlan ? translateRepairPlan(issue.proposedPlan, dict, locale) : null} />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">{dict.targetCompletion}</dt>
              <dd className={overdue ? "text-end font-medium text-red-600" : "text-end text-slate-800"}>
                {issue.proposedCompletionDate ? formatDate(issue.proposedCompletionDate, "dd MMM yyyy", locale) : "—"}
                {overdue && ` ${dict.overdueSuffix}`}
              </dd>
            </div>
            <Row label={dict.completedBy} value={issue.completedByName ? dict.knownPersonLabels[issue.completedByName] ?? issue.completedByName : null} />
            <Row
              label={dict.completedAt}
              value={issue.completedAt ? formatDate(issue.completedAt, "dd MMM yyyy HH:mm", locale) : null}
            />
            <Row label={dict.completionNotes} value={issue.completionNotes} />
          </dl>
        </Card>
      </div>

      {issue.status === "REPORTED" && !issue.acknowledgedAt && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.acknowledgeTitle}</h2>
          {canManage ? (
            <form action={acknowledgeStructuralIssueAction.bind(null, issue.id)} className="mt-2">
              <ConfirmSubmitButton
                confirmMessage={dict.acknowledgeConfirm}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-900 border border-slate-300 transition-colors hover:bg-slate-50"
              >
                {dict.acknowledgeButton}
              </ConfirmSubmitButton>
            </form>
          ) : (
            <p className="mt-2 text-xs text-slate-400">{dict.onlyMaintenance}</p>
          )}
        </Card>
      )}

      {issue.status === "REPORTED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.confirmDamageTitle}</h2>
          {canManage ? <PlanForm issueId={issue.id} /> : <p className="mt-2 text-xs text-slate-400">{dict.onlyMaintenance}</p>}
        </Card>
      )}

      {issue.status === "PLANNED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">{dict.markCompletedTitle}</h2>
          {canManage ? <CompleteForm issueId={issue.id} /> : <p className="mt-2 text-xs text-slate-400">{dict.onlyMaintenance}</p>}
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          {dict.photosTitle} ({issue.photos.length})
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {issue.photos.map((p) => {
            const isImage = /\.(jpe?g|png)$/i.test(p.fileName);
            return (
              <div key={p.id} className="rounded-md border border-slate-200 p-2">
                <a href={`/api/files/structural-issue-photos/${p.fileName}`} target="_blank" rel="noopener noreferrer" className="block">
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/files/structural-issue-photos/${p.fileName}`}
                      alt={p.caption ?? p.originalName}
                      className="h-32 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded bg-slate-50 text-sm text-emerald-700 hover:underline">
                      {common.viewPdf}
                    </div>
                  )}
                </a>
                {p.caption && <p className="mt-2 text-xs text-slate-700">{p.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {p.uploadedBy?.name ?? common.unknown} · {formatDate(p.createdAt, "dd MMM yyyy HH:mm", locale)}
                </p>
                <form action={removeStructuralIssuePhotoAction.bind(null, issue.id, p.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage={dict.removePhotoConfirm}>{common.remove}</ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {issue.photos.length === 0 && <p className="col-span-3 py-2 text-sm text-slate-400">{dict.noPhotos}</p>}
        </div>

        <form
          action={addStructuralIssuePhotoAction.bind(null, issue.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <FieldGroup label={common.photoOrDocument}>
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label={common.captionOptional}>
            <Input name="caption" className="w-56" placeholder={dict.captionPlaceholder} />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            {common.upload}
          </Button>
        </form>
      </Card>
    </div>
  );
}
