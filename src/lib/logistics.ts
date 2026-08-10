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

export type ChecklistItem = { key: string; label: string; done: boolean };

type ChecklistContainer = {
  sealNumber: string | null;
  reeferSetPointC: number | null;
  loadLineConfirmedAt: Date | null;
  manifestReopenedAt: Date | null;
  loadPhotos: { createdAt: Date }[];
};

// Everything here is a fact that isn't already enforced elsewhere in the
// load-out flow (unlike e.g. stickering, which addPalletLoadLineAction
// already refuses to load without) -- this is the pre-departure checklist
// both sign-offs are gated on, in src/app/(app)/logistics/actions.ts.
export function computeContainerChecklist(container: ChecklistContainer): ChecklistItem[] {
  // A reopened manifest may hold different pallets than what the load line
  // was confirmed against or the photo was taken of -- only a photo taken
  // after the most recent reopen counts as evidence of the current load.
  const photoIsCurrent = container.loadPhotos.some(
    (p) => !container.manifestReopenedAt || p.createdAt >= container.manifestReopenedAt
  );

  return [
    { key: "seal", label: "Seal number recorded", done: !!container.sealNumber },
    { key: "reefer", label: "Reefer temperature set-point recorded", done: container.reeferSetPointC != null },
    {
      key: "loadLine",
      label: "Confirmed: cartons/pallets did not exceed the container's load line (red line)",
      done: !!container.loadLineConfirmedAt,
    },
    { key: "photo", label: "Photo of the loaded container uploaded before closing the doors", done: photoIsCurrent },
  ];
}

export function isChecklistComplete(container: ChecklistContainer): boolean {
  return computeContainerChecklist(container).every((item) => item.done);
}
