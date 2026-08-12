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

// A full pallet is a known, fixed quantity -- no need to weigh or count it
// by hand at packing time. A partial pallet's weight/carton count varies, so
// those still need manual entry.
export const FULL_PALLET_WEIGHT_TONNES = 1.2;
export const FULL_PALLET_CARTON_COUNT = 120;

/** A manifest that already has both sign-offs on file is locked against further edits -- see reopenContainerManifestAction. */
export function isManifestLocked(container: { loadOutSignedAt: Date | null; qualitySignedAt: Date | null }): boolean {
  return !!container.loadOutSignedAt && !!container.qualitySignedAt;
}

export const MANIFEST_LOCKED_MESSAGE =
  "This container's manifest is locked -- both sign-offs are already on file. Reopen it first (with a reason) to make changes.";

export type ChecklistItem = { key: string; label: string; done: boolean };

// Every manual item a person has to physically confirm before either
// sign-off is accepted (see ContainerChecklistConfirmation + generic
// confirmChecklistItemAction) -- a config array, not one field pair per item,
// so adding a 5th or 6th item later is just another entry here, not a
// schema migration. `resetOnReopen: false` marks a fact about the empty
// container itself (checked once, before any pallet went in) that a later
// manifest correction doesn't invalidate; everything else describes the
// final loaded state and goes stale the moment the manifest can change again.
export const CONTAINER_CHECKLIST_ITEMS: {
  key: string;
  label: string;
  confirmMessage: string;
  buttonLabel: string;
  resetOnReopen: boolean;
}[] = [
  {
    key: "preLoadInspection",
    label: "Confirmed: empty container inspected before loading — clean, dry, no foreign odor, no damage",
    confirmMessage:
      "Confirm the empty container was inspected before loading began — clean, dry, free of foreign odor, and with no damage to the walls or door seals? A contaminated or damaged container is a real rejection risk on arrival.",
    buttonLabel: "Confirm — container inspected",
    resetOnReopen: false,
  },
  {
    key: "stickering",
    label: "Confirmed: all cartons carry the correct client stickers",
    confirmMessage:
      "Confirm every carton loaded into this container carries the correct client sticker? This is a final visual check across the whole load, not just the per-pallet flag.",
    buttonLabel: "Confirm — all cartons stickered",
    resetOnReopen: true,
  },
  {
    key: "coldChain",
    label: "Confirmed: cold chain maintained — container opened and loaded entirely inside the load-out bay",
    confirmMessage:
      "Confirm the container was opened and loaded entirely inside the load-out bay, with no break in the cold chain or condensation exposure? Opening a reefer outside the bay exposes frozen product to ambient heat and humidity.",
    buttonLabel: "Confirm — cold chain maintained",
    resetOnReopen: true,
  },
  {
    key: "loadLine",
    label: "Confirmed: cartons/pallets did not exceed the container's load line (red line)",
    confirmMessage:
      "Confirm that no cartons or pallets exceed the container's marked load line (red line)? This is a physical visual check, not a formality -- cartons above the line block reefer airflow and can cause a temperature excursion in transit.",
    buttonLabel: "Confirm — red line not exceeded",
    resetOnReopen: true,
  },
];

export function isValidChecklistItemKey(key: string): boolean {
  return CONTAINER_CHECKLIST_ITEMS.some((i) => i.key === key);
}

type ChecklistContainer = {
  sealNumber: string | null;
  reeferSetPointC: number | null;
  manifestReopenedAt: Date | null;
  loadPhotos: { createdAt: Date }[];
  checklistConfirmations: { itemKey: string; confirmedAt: Date }[];
};

// Everything here is a fact that isn't already enforced elsewhere in the
// load-out flow (unlike e.g. the per-pallet stickering flag, which
// addPalletLoadLineAction already refuses to load without) -- this is the
// pre-departure checklist both sign-offs are gated on, in
// src/app/(app)/logistics/actions.ts.
export function computeContainerChecklist(container: ChecklistContainer): ChecklistItem[] {
  // A reopened manifest may hold different pallets than what a "final
  // loaded state" item was confirmed against or the photo was taken of --
  // only evidence from after the most recent reopen counts as current.
  const photoIsCurrent = container.loadPhotos.some(
    (p) => !container.manifestReopenedAt || p.createdAt >= container.manifestReopenedAt
  );

  const manualItems = CONTAINER_CHECKLIST_ITEMS.map((item) => {
    const confirmation = container.checklistConfirmations.find((c) => c.itemKey === item.key);
    const done =
      !!confirmation &&
      (!item.resetOnReopen || !container.manifestReopenedAt || confirmation.confirmedAt >= container.manifestReopenedAt);
    return { key: item.key, label: item.label, done };
  });

  return [
    { key: "seal", label: "Seal number recorded", done: !!container.sealNumber },
    { key: "reefer", label: "Reefer temperature set-point recorded", done: container.reeferSetPointC != null },
    ...manualItems,
    { key: "photo", label: "Photo of the loaded container uploaded before closing the doors", done: photoIsCurrent },
  ];
}

export function isChecklistComplete(container: ChecklistContainer): boolean {
  return computeContainerChecklist(container).every((item) => item.done);
}
