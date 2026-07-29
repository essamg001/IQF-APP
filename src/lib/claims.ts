import type { ClaimStatus } from "@prisma/client";

// The claim lifecycle only moves forward (Open -> Under Review ->
// Resolved/Credited -> Closed, see advanceClaimStatusAction), so a Closed
// claim already passed through Resolved/Credited on its way there -- it's
// simply the archival state afterward, not a different outcome. Anything
// checking whether a claim counts against net revenue must treat both the
// same, or a claim silently stops reducing net revenue the moment it's
// closed out.
export const CREDITED_CLAIM_STATUSES: ClaimStatus[] = ["RESOLVED_CREDITED", "CLOSED"];

export function isCreditedClaim(status: ClaimStatus): boolean {
  return CREDITED_CLAIM_STATUSES.includes(status);
}
