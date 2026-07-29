import type { MicrobiologyStatus, LabType, Prisma } from "@prisma/client";

// Every lot's sample is tested in both labs -- neither is a substitute for
// the other, so a lot only clears once both come back Approved. ON_HOLD is
// a distinct state from a straight failure: it means the two labs disagreed
// (one Approved, one Failed) and every lot from the same shift is blocked
// pending further testing, since the risk isn't known to be specific to the
// one sampled lot.
export type CombinedMicroStatus = MicrobiologyStatus | "ON_HOLD";

type MicroResultLike = { status: MicrobiologyStatus; labType: LabType };

const RESOLVED: MicrobiologyStatus[] = ["APPROVED", "FAILED_MINOR", "FAILED_SEVERE"];

// Both IN_HOUSE and EXTERNAL must be present and individually Approved --
// checking only "every result present is Approved" would treat a lot with
// just one lab's row (e.g. malformed data, a future import gap) as fully
// cleared, when the other lab was never actually consulted.
const REQUIRED_LAB_TYPES: LabType[] = ["IN_HOUSE", "EXTERNAL"];

function isFullyApproved(results: MicroResultLike[]): boolean {
  return REQUIRED_LAB_TYPES.every((labType) => results.some((r) => r.labType === labType && r.status === "APPROVED"));
}

// The Prisma-query equivalent of isMicroCleared's "both labs Approved" check
// -- for filtering ProductionLot directly in a `where`, where a TS function
// can't be called. `every: { status: "APPROVED" }, some: {}` looks
// equivalent but isn't: it's satisfied by a lot with just ONE lab's row
// (e.g. malformed data), since `every` is vacuously true for whatever subset
// of labs actually has a row. Requiring each lab type by name closes that gap.
export const bothLabsApprovedFilter: Prisma.ProductionLotWhereInput = {
  AND: REQUIRED_LAB_TYPES.map((labType) => ({
    microbiologyResults: { some: { labType, status: "APPROVED" as const } },
  })),
};

export const notBothLabsApprovedFilter: Prisma.ProductionLotWhereInput = { NOT: bothLabsApprovedFilter };

export function combinedMicroStatus(results: MicroResultLike[], shiftOnHold: boolean): CombinedMicroStatus {
  if (shiftOnHold) return "ON_HOLD";
  if (results.some((r) => r.status === "FAILED_SEVERE")) return "FAILED_SEVERE";
  if (results.some((r) => r.status === "FAILED_MINOR")) return "FAILED_MINOR";
  if (isFullyApproved(results)) return "APPROVED";
  if (results.some((r) => r.status === "SENT_TO_LAB")) return "SENT_TO_LAB";
  return "PENDING";
}

/** True once a pallet/lot is actually clear to load or sell: both labs in, both Approved, shift not on hold. */
export function isMicroCleared(results: MicroResultLike[], shiftOnHold: boolean): boolean {
  return !shiftOnHold && isFullyApproved(results);
}

/** True once both lab results for a lot are resolved and they disagree -- one Approved, the other Failed (Minor or Severe). */
export function isSplitResult(results: { status: MicrobiologyStatus }[]): boolean {
  const resolved = results.filter((r) => RESOLVED.includes(r.status));
  if (resolved.length < 2) return false;
  const hasApproved = resolved.some((r) => r.status === "APPROVED");
  const hasFailed = resolved.some((r) => r.status === "FAILED_MINOR" || r.status === "FAILED_SEVERE");
  return hasApproved && hasFailed;
}
