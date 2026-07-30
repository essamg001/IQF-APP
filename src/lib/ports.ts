// Egypt's commercial ports that actually handle containerized/reefer export
// cargo. Damietta is listed first since it's the factory's own port. Kept as
// a plain list (not an enum) so a shipment through an unlisted port isn't
// blocked -- the form falls back to free text for anything not on here.
export const EGYPT_COMMERCIAL_PORTS = [
  "Damietta Port",
  "Alexandria Port",
  "El Dekheila Port (Alexandria)",
  "East Port Said",
  "Ain Sokhna Port (Suez)",
  "Safaga Port",
] as const;
