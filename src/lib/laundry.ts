// HSE03296 -- garment types tracked on the Packhouse 11,13 laundry register.
// Each entry's value on a LaundryRecord is a piece number from the laundry's
// monthly register, not a count -- key must match a LaundryRecord field name.
export const GARMENT_TYPES: { key: string; label: string }[] = [
  { key: "whiteCoatNo", label: "White Coat" },
  { key: "whiteTrousersNo", label: "White Trousers" },
  { key: "blueCoatNo", label: "Blue Coat" },
  { key: "visitorCoatNo", label: "Visitor Coat" },
  { key: "maintenanceOverallNo", label: "Maintenance Overall" },
  { key: "yellowCoatNo", label: "Yellow Coat" },
  { key: "greenCoatNo", label: "Green Coat" },
  { key: "yellowSuitNo", label: "Yellow Suit" },
  { key: "coldStoreSuitNo", label: "Cold Store Suit" },
  { key: "greyJacketNo", label: "Grey Jacket" },
  { key: "blackJacketNo", label: "Black Jacket" },
  { key: "glovesNo", label: "Gloves" },
  { key: "whiteHeadscarfNo", label: "White Headscarf" },
  { key: "towelNo", label: "Towel" },
  { key: "capNo", label: "Cap" },
  { key: "blueSuitNo", label: "Blue Suit" },
];

export const DEFAULT_LAUNDRY_PACKHOUSE = "PKH 11,13";

/** Same lock-once-both-signed rule as Cleaning Mode -- see isCleaningLocked. */
export function isLaundrySignOffLocked(
  signOff: { supervisorSignedAt: Date | null; verifiedSignedAt: Date | null } | null | undefined
): boolean {
  return !!signOff?.supervisorSignedAt && !!signOff?.verifiedSignedAt;
}
