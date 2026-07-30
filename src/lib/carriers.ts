// Ordered by actual frequency in this factory's own shipment history (the
// first seven are already in real use -- spelling matches their established
// convention exactly, "Hapag Lloyed" included, so existing containers show
// up correctly selected in the dropdown instead of falling to "Other").
// Kept as a plain list (not an enum) so a carrier not on here doesn't block
// entry -- the form falls back to free text for anything unlisted.
export const CONTAINER_CARRIERS = [
  "Maersk",
  "ONE",
  "MSC",
  "Hapag Lloyed",
  "CMA",
  "COSCO",
  "SEALAND",
  "Evergreen Line",
  "Yang Ming",
  "ZIM",
  "HMM",
] as const;
