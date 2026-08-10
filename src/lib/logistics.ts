// A container holds ~25t loose (unpalletised, cartons stacked directly) or
// ~24t palletised -- the pallet base itself eats into the usable volume.
// Shared between the container page (display) and the load-out actions
// (hard enforcement), so the two can never drift apart.
export const CAPACITY_TONNES: Record<"PALLETISED" | "UNPALLETISED", number> = {
  PALLETISED: 24,
  UNPALLETISED: 25,
};

export const LOAD_TYPE_LABEL: Record<"PALLETISED" | "UNPALLETISED", string> = {
  PALLETISED: "palletised",
  UNPALLETISED: "unpalletised",
};

/** A manifest that already has both sign-offs on file is locked against further edits -- see reopenContainerManifestAction. */
export function isManifestLocked(container: { loadOutSignedAt: Date | null; qualitySignedAt: Date | null }): boolean {
  return !!container.loadOutSignedAt && !!container.qualitySignedAt;
}

export const MANIFEST_LOCKED_MESSAGE =
  "This container's manifest is locked -- both sign-offs are already on file. Reopen it first (with a reason) to make changes.";
