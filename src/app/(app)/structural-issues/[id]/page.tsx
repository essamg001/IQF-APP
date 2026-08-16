import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { format } from "date-fns";
import { canSignAsHeadOfMaintenance } from "@/lib/roles";
import { isStructuralIssueOverdue } from "@/lib/structuralIssues";
import { addStructuralIssuePhotoAction, removeStructuralIssuePhotoAction } from "../actions";
import { PlanForm } from "./plan-form";
import { CompleteForm } from "./complete-form";

const STATUS_COLOR = {
  REPORTED: "amber",
  PLANNED: "blue",
  COMPLETED: "green",
} as const;

const STATUS_LABEL = {
  REPORTED: "Reported",
  PLANNED: "Planned",
  COMPLETED: "Completed",
} as const;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{value}</dd>
    </div>
  );
}

export default async function StructuralIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
        <h1 className="text-xl font-semibold text-slate-900">{issue.location}</h1>
        <Badge color={STATUS_COLOR[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
        {overdue && <Badge color="red">Overdue</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Report</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Factory" value={issue.factory.name} />
            <Row label="Description" value={issue.description} />
            <Row label="Reported by" value={issue.reportedByName} />
            <Row label="Reported" value={format(issue.reportedAt, "dd MMM yyyy HH:mm")} />
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Maintenance</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Confirmed by" value={issue.confirmedByName} />
            <Row label="Confirmed" value={issue.confirmedAt ? format(issue.confirmedAt, "dd MMM yyyy HH:mm") : null} />
            <Row label="Repair plan" value={issue.proposedPlan} />
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Target completion</dt>
              <dd className={overdue ? "text-right font-medium text-red-600" : "text-right text-slate-800"}>
                {issue.proposedCompletionDate ? format(issue.proposedCompletionDate, "dd MMM yyyy") : "—"}
                {overdue && " (overdue)"}
              </dd>
            </div>
            <Row label="Completed by" value={issue.completedByName} />
            <Row label="Completed" value={issue.completedAt ? format(issue.completedAt, "dd MMM yyyy HH:mm") : null} />
            <Row label="Completion notes" value={issue.completionNotes} />
          </dl>
        </Card>
      </div>

      {issue.status === "REPORTED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Confirm damage & commit to a repair plan</h2>
          {canManage ? (
            <PlanForm issueId={issue.id} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only the Owner or Head of Maintenance can do this.</p>
          )}
        </Card>
      )}

      {issue.status === "PLANNED" && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Mark as completed</h2>
          {canManage ? (
            <CompleteForm issueId={issue.id} />
          ) : (
            <p className="mt-2 text-xs text-slate-400">Only the Owner or Head of Maintenance can do this.</p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Photos ({issue.photos.length})</h2>
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
                      View PDF
                    </div>
                  )}
                </a>
                {p.caption && <p className="mt-2 text-xs text-slate-700">{p.caption}</p>}
                <p className="mt-1 text-xs text-slate-400">
                  {p.uploadedBy?.name ?? "Unknown"} · {format(p.createdAt, "dd MMM yyyy HH:mm")}
                </p>
                <form action={removeStructuralIssuePhotoAction.bind(null, issue.id, p.id)} className="mt-1">
                  <ConfirmSubmitButton confirmMessage="Remove this photo? This cannot be undone.">Remove</ConfirmSubmitButton>
                </form>
              </div>
            );
          })}
          {issue.photos.length === 0 && <p className="col-span-3 py-2 text-sm text-slate-400">No photos uploaded yet.</p>}
        </div>

        <form
          action={addStructuralIssuePhotoAction.bind(null, issue.id)}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4"
        >
          <FieldGroup label="Photo or document (JPEG, PNG, or PDF)">
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              required
              className="block w-64 text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
            />
          </FieldGroup>
          <FieldGroup label="Caption (optional)">
            <Input name="caption" className="w-56" placeholder="e.g. Crack extent, close-up" />
          </FieldGroup>
          <Button type="submit" variant="secondary">
            Upload
          </Button>
        </form>
      </Card>
    </div>
  );
}
