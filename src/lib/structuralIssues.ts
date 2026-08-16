import type { StructuralIssueStatus } from "@prisma/client";

// The point of storing a proposed completion date is to catch the case where
// maintenance itself becomes the delay -- "overdue" means still Planned past
// the date they committed to, not just "old."
export function isStructuralIssueOverdue(
  issue: { status: StructuralIssueStatus; proposedCompletionDate: Date | null },
  now: Date = new Date()
): boolean {
  return issue.status === "PLANNED" && !!issue.proposedCompletionDate && now > issue.proposedCompletionDate;
}
