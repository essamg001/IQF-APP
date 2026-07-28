import type { MicrobiologyStatus } from "@prisma/client";

// Every lot's sample is tested in both labs -- neither is a substitute for
// the other, so a lot only clears once both come back Approved. ON_HOLD is
// a distinct state from a straight failure: it means the two labs disagreed
// (one Approved, one Failed) and every lot from the same shift is blocked
// pending further testing, since the risk isn't known to be specific to the
// one sampled lot.
export type CombinedMicroStatus = MicrobiologyStatus | "ON_HOLD";

const RESOLVED: MicrobiologyStatus[] = ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"];

export function combinedMicroStatus(results: { status: MicrobiologyStatus }[], shiftOnHold: boolean): CombinedMicroStatus {
  if (shiftOnHold) return "ON_HOLD";
  if (results.some((r) => r.status === "FAILED_SEVERE")) return "FAILED_SEVERE";
  if (results.some((r) => r.status === "FAILED_MINOR")) return "FAILED_MINOR";
  if (results.length > 0 && results.every((r) => r.status === "APPROVED")) return "APPROVED";
  if (results.some((r) => r.status === "SENT_TO_LAB")) return "SENT_TO_LAB";
  return "PENDING";
}

/** True once a pallet/lot is actually clear to load or sell: both labs in, both Approved, shift not on hold. */
export function isMicroCleared(results: { status: MicrobiologyStatus }[], shiftOnHold: boolean): boolean {
  return !shiftOnHold && results.length > 0 && results.every((r) => r.status === "APPROVED");
}

/** True once both lab results for a lot are resolved and they disagree -- one Approved, the other Failed (Minor or Severe). */
export function isSplitResult(results: { status: MicrobiologyStatus }[]): boolean {
  const resolved = results.filter((r) => RESOLVED.includes(r.status));
  if (resolved.length < 2) return false;
  const hasApproved = resolved.some((r) => r.status === "APPROVED");
  const hasFailed = resolved.some((r) => r.status === "FAILED_MINOR" || r.status === "FAILED_SEVERE");
  return hasApproved && hasFailed;
}
