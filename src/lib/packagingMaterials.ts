// Closing balance is derived, not stored -- opening plus received minus
// used minus damaged. A typed balance can drift from reality; a computed
// one can't (same reasoning as isStructuralIssueOverdue / injuryLog.
// runningBalances).
export function closingBalance(
  opening: number | null,
  received: number | null,
  used: number | null,
  damaged: number | null
): number | null {
  if (opening == null) return null;
  return opening + (received ?? 0) - (used ?? 0) - (damaged ?? 0);
}
