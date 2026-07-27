import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, FieldGroup } from "@/components/ui/field";
import { toggleQualityIssueStatusAction, updateCorrectiveActionAction } from "../actions";
import { format } from "date-fns";

export default async function QualityIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const issue = await prisma.qualityIssue.findUnique({
    where: { id },
    include: { client: true },
  });
  if (!issue) notFound();

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
          <Button type="submit" variant={issue.status === "OPEN" ? "primary" : "secondary"}>
            {issue.status === "OPEN" ? "Mark Resolved" : "Reopen"}
          </Button>
        </form>
      </div>

      <Card className="space-y-3">
        <Row label="Related Reference" value={issue.relatedReference} />
        <Row label="What Happened" value={issue.issueDetails} />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Corrective Action</h2>
        <form action={updateCorrectiveActionAction.bind(null, issue.id)} className="space-y-3">
          <FieldGroup label="What was done to prevent a repeat of this issue">
            <Input name="correctiveAction" defaultValue={issue.correctiveAction ?? ""} placeholder="e.g. Purchased an optical sorter…" />
          </FieldGroup>
          <Button type="submit">Save</Button>
        </form>
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
