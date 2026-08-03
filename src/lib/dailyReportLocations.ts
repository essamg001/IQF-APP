// Fixed reference metadata (Limits + Instrument) for each temperature-log
// location on the real paper "Frozen Strawberry Production Report" -- this is
// per-location reference info, not something that varies per reading, so it
// lives here rather than in the database (same reasoning as ROLE_LABELS in
// src/lib/roles.ts).

export type TemperatureLocation = {
  name: string;
  limits: string;
  instrument: string;
};

const COMMON_LOCATIONS: TemperatureLocation[] = [
  { name: "Raw Material (Incoming)", limits: "NA", instrument: "Thermometer" },
  { name: "Pre-Cooling", limits: "5 : 10 °C", instrument: "Monitor" },
  { name: "Raw Material (Intake)", limits: "NA", instrument: "Thermometer" },
  { name: "Washer-1", limits: "NA", instrument: "Thermometer" },
  { name: "Washer-2", limits: "< 10 °C", instrument: "Thermometer" },
  { name: "Chiller", limits: "< 2 °C", instrument: "Thermometer" },
  { name: "Production Hall", limits: "14 : 16 °C", instrument: "Monitor" },
  { name: "Pre-Freezer", limits: "NA", instrument: "Thermometer" },
  { name: "Freezer Air", limits: "- 40 °C", instrument: "Monitor" },
  { name: "Ammonia Temperature", limits: "- 44 °C", instrument: "Monitor" },
  { name: "Post-Freezer", limits: "- 15 °C", instrument: "Thermometer" },
  { name: "High Care", limits: "4 : 6 °C", instrument: "Monitor" },
  { name: "Water Pressure", limits: "counter", instrument: "Pr.G" },
];

// IQF 11's own refrigerator corridor/rooms, per the real report.
const IQF_11_LOCATIONS: TemperatureLocation[] = [
  { name: "Refrigerator Corridor (11)", limits: "NA", instrument: "Monitor" },
  { name: "Refrigerator Room 1", limits: "- 18 °C", instrument: "Monitor" },
  { name: "Refrigerator Room 2", limits: "- 18 °C", instrument: "Monitor" },
  { name: "Sample Room", limits: "- 18 °C", instrument: "Monitor" },
  { name: "Loading Room", limits: "0 °C", instrument: "Monitor" },
];

// IQF 13's own refrigerator corridor/rooms.
const IQF_13_LOCATIONS: TemperatureLocation[] = [
  { name: "Refrigerator Corridor (13)", limits: "NA", instrument: "Monitor" },
  { name: "Refrigerator Room 3", limits: "- 18 °C", instrument: "Monitor" },
  { name: "Refrigerator Room 4", limits: "- 18 °C", instrument: "Monitor" },
  { name: "Refrigerator Room 5", limits: "- 18 °C", instrument: "Monitor" },
];

export function getTemperatureLocations(factoryCode: string | null | undefined): TemperatureLocation[] {
  const specific = factoryCode === "13" ? IQF_13_LOCATIONS : IQF_11_LOCATIONS;
  return [...COMMON_LOCATIONS, ...specific];
}

export function limitsAndInstrumentFor(factoryCode: string | null | undefined, location: string): TemperatureLocation | undefined {
  return getTemperatureLocations(factoryCode).find((l) => l.name === location);
}
