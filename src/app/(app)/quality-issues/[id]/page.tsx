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

export default async function QualityIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const currentUserLabel = session?.user.name ?? session?.user.email ?? null;

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
    ? { href: `/orders/${issue.relatedOrder.id}`, label: `Order ${issue.relatedOrder.orderNumber}` }
    : issue.relatedContainer
      ? { href: `/logistics/${issue.relatedContainer.id}`, label: `Container ${issue.relatedContainer.containerNumber}` }
      : issue.relatedLot
        ? { href: `/production/${issue.relatedLot.id}`, label: `Lot ${issue.relatedLot.lotNumber}` }
        : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              Quality Issue — {issue.client?.name ?? "Internal"}
            </h1>
            <Badge color={issue.status === "OPEN" ? "amber" : "green"}>{issue.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {format(issue.issueDate, "dd MMM yyyy")} · {issue.reason.replace("_", " ")}
            {issue.variety ? ` · ${issue.variety}` : ""}
          </p>
        </div>
        <form action={toggleQualityIssueStatusAction.bind(null, issue.id)}>
          <ConfirmSubmitButton
            confirmMessage={
              issue.status === "OPEN"
                ? "Mark this quality issue as resolved?"
                : "Reopen this quality issue?"
            }
            className={
              issue.status === "OPEN"
                ? "inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                : "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50"
            }
          >
            {issue.status === "OPEN" ? "Mark Resolved" : "Reopen"}
          </ConfirmSubmitButton>
        </form>
      </div>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-0">
          <dt className="text-sm text-slate-500">Related Reference</dt>
          <dd className="text-right text-sm font-medium">
            {resolvedReference ? (
              <a href={resolvedReference.href} className="text-emerald-700 hover:underline">
                {issue.relatedReference} → {resolvedReference.label}
              </a>
            ) : issue.relatedReference ? (
              <span className="text-red-600">{issue.relatedReference} (not found — check for a typo)</span>
            ) : (
              <span className="text-slate-800">—</span>
            )}
          </dd>
        </div>
        <Row label="What Happened" value={issue.issueDetails} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Root Cause &amp; Corrective Action</h2>
        <form action={updateCapaAction.bind(null, issue.id)} className="space-y-3">
          <FieldGroup label="Root cause — why did this actually happen">
            <Input name="rootCause" defaultValue={issue.rootCause ?? ""} placeholder="e.g. Sorter calibration drifted out of spec after the belt change" />
          </FieldGroup>
          <FieldGroup label="Corrective action — what was done to prevent a repeat">
            <Input name="correctiveAction" defaultValue={issue.correctiveAction ?? ""} placeholder="e.g. Purchased an optical sorter…" />
          </FieldGroup>
          <Button type="submit">Save</Button>
        </form>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Verification</h2>
        <p className="text-xs text-slate-500">
          Confirms the corrective action above actually stopped the issue recurring — a distinct step, often by a
          different person, done once the fix has had time to prove itself.
        </p>
        {issue.verifiedByName ? (
          <div className="text-sm">
            <p className="text-slate-800">
              {issue.verifiedByName}
              <span className="ml-2 text-xs text-slate-500">{issue.verifiedAt?.toLocaleString()}</span>
            </p>
            {issue.verificationNotes && <p className="mt-1 text-xs text-slate-500">{issue.verificationNotes}</p>}
          </div>
        ) : !issue.rootCause?.trim() || !issue.correctiveAction?.trim() ? (
          <p className="text-xs text-slate-400">Fill in root cause and corrective action above before verifying.</p>
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
