// Same lock-once-confirmed rule as Cleaning Mode / Laundry -- see
// isCleaningLocked / isLaundrySignOffLocked. This checklist only has one
// signer (not a two-person sign-off), so "locked" is just "someone already
// confirmed it" rather than "both sides confirmed it."
export function isMetalDetectorMaintenanceLocked(
  record: { checkedByName: string | null } | null | undefined
): boolean {
  return !!record?.checkedByName;
}
