// Transcribed from the paper "IQF Manager Daily Checklist" form. Item text
// is kept verbatim (including its original phrasing) since it's the real
// operational document staff are trained against -- rewording it here would
// make the digital version disagree with the paper one. Section letters C,
// F, and G were cut off in the source photos; they're inferred from the
// visible A/B/D/E/H sequence.
export type DailyChecklistSection = {
  key: string;
  letter: string;
  label: string;
  items: { key: string; text: string }[];
};

export const DAILY_CHECKLIST_SECTIONS: DailyChecklistSection[] = [
  {
    key: "RECEIVING",
    letter: "A",
    label: "Recieving Area",
    items: [
      { key: "RECEIVING_1", text: "Floors are intact, free from defects, rust, or peeling coatings" },
      { key: "RECEIVING_2", text: "Pest monitoring devices (traps) are intact, working, and correctly positioned" },
      { key: "RECEIVING_3", text: "Receiving area cleanliness is maintained according to hygiene standards" },
      { key: "RECEIVING_4", text: "Receiving Supervisor implements all trained receiving instructions/SOPs" },
      { key: "RECEIVING_5", text: "Inspection log entries are accurately and completely registered by the supervisor" },
      { key: "RECEIVING_6", text: "Empty raw crates are regularly stacked and promptly moved to the de-capping station" },
      { key: "RECEIVING_7", text: "Vehicle unloading operations are conducted efficiently, meeting turnaround time targets" },
    ],
  },
  {
    key: "PRECOOLING",
    letter: "B",
    label: "Pre-cooling Area",
    items: [
      { key: "PRECOOLING_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "PRECOOLING_2", text: "Raw Feed Hall Temperature 5°C" },
      { key: "PRECOOLING_3", text: "Floors are intact" },
      { key: "PRECOOLING_4", text: "No rust or peeling" },
      { key: "PRECOOLING_5", text: "Traps and detonators are intact, working and in place" },
      { key: "PRECOOLING_6", text: "Raw Feed Lounge Cleaner" },
      { key: "PRECOOLING_7", text: "Organizing and stacking all pallets in the right way and separating grades and items" },
      { key: "PRECOOLING_8", text: "Door rules: never open the outer door while the inner is open, and vice versa" },
      { key: "PRECOOLING_9", text: "Workers in the movement of ore and nutrition are committed to walking regularly at all times" },
      { key: "PRECOOLING_10", text: "Regular raw feed (no accumulation and no gaps)" },
      { key: "PRECOOLING_11", text: "Collect all broken and violating dishes" },
    ],
  },
  {
    key: "PRODUCTION",
    letter: "C",
    label: "Production Area",
    items: [
      { key: "PRODUCTION_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "PRODUCTION_2", text: "Floors are intact" },
      { key: "PRODUCTION_3", text: "No rust or peeling" },
      { key: "PRODUCTION_4", text: "Traps and detonators are intact, working and in place" },
      { key: "PRODUCTION_5", text: "Operating Lounge Cleaner" },
      { key: "PRODUCTION_6", text: "Cleaning of wash basin water filters and waste collection in perishable bins" },
      { key: "PRODUCTION_7", text: "Supervisors and employees adhere to health and safety instructions" },
      { key: "PRODUCTION_8", text: "Operating room temperature 14°C" },
      { key: "PRODUCTION_9", text: "Matching the temperature of the chiller water to the instructions" },
      { key: "PRODUCTION_10", text: "Adhere to the colors of the dishes for both sorting and executing" },
      { key: "PRODUCTION_11", text: "PCB Calibration" },
      { key: "PRODUCTION_12", text: "Supplier PCB Conformity to the Specification from Data Sheet" },
      { key: "PRODUCTION_13", text: "Hourly measurement" },
      { key: "PRODUCTION_14", text: "Chlorine level conforms to customer specification" },
      { key: "PRODUCTION_15", text: "The freezer is clean" },
      { key: "PRODUCTION_16", text: "Clean freezer cleaning tools" },
      { key: "PRODUCTION_17", text: "No product hanging on the sides of the freezer" },
      { key: "PRODUCTION_18", text: "Freezer Air Temperature - 40°C" },
      { key: "PRODUCTION_19", text: "Ammonia Temperature - 44°C" },
    ],
  },
  {
    key: "PACKAGING",
    letter: "D",
    label: "Packaging Area",
    items: [
      { key: "PACKAGING_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "PACKAGING_2", text: "Floors are intact" },
      { key: "PACKAGING_3", text: "No rust or peeling" },
      { key: "PACKAGING_4", text: "Traps and detonators are intact, working and in place" },
      { key: "PACKAGING_5", text: "Cleaning Packing Hall" },
      { key: "PACKAGING_6", text: "Application of Supervisors and Workers in the Packing Hall to High Care Standards" },
      { key: "PACKAGING_7", text: "Packing hall temperature 5°C" },
      { key: "PACKAGING_8", text: "Finished Product Temperature -18°C" },
      { key: "PACKAGING_9", text: "Cartons are sealed well and regularly" },
      { key: "PACKAGING_10", text: "Pallets are well-stacked with correct carton orientation, aligned corners, and a cover on each" },
      { key: "PACKAGING_11", text: "Fast entry of the final product into refrigerators" },
    ],
  },
  {
    key: "COLD_STORES",
    letter: "E",
    label: "Cold Stores",
    items: [
      { key: "COLD_STORES_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "COLD_STORES_2", text: "Floors are intact" },
      { key: "COLD_STORES_3", text: "No rust or peeling" },
      { key: "COLD_STORES_4", text: "Traps and detonators are intact, working and in place" },
      { key: "COLD_STORES_5", text: "Refrigerator Cleaner" },
      { key: "COLD_STORES_6", text: "Operating room temperature -18°C" },
      { key: "COLD_STORES_7", text: "Stacking the bits inside the refrigerators regularly according to specifications and production date" },
      { key: "COLD_STORES_8", text: "All pallets have the lot on them" },
      { key: "COLD_STORES_9", text: "Clarkat drivers close doors, move safely and steadily, and their alarms work properly." },
    ],
  },
  {
    key: "LOADING",
    letter: "F",
    label: "Loading Area",
    items: [
      { key: "LOADING_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "LOADING_2", text: "Floors are intact" },
      { key: "LOADING_3", text: "No rust or peeling" },
      { key: "LOADING_4", text: "Traps and detonators are intact, working and in place" },
      { key: "LOADING_5", text: "Loading Room Cleaner" },
      { key: "LOADING_6", text: "Container cleanliness and it operates at a temperature of -18°C" },
      { key: "LOADING_7", text: "Print the stickers correctly and in the required number" },
      { key: "LOADING_8", text: "Only one pallet per container; no rushing loading." },
      { key: "LOADING_9", text: "Safety of cartons and sealing them with blue slotipe only" },
      { key: "LOADING_10", text: "The cartons in the container do not exceed the red line" },
    ],
  },
  {
    key: "WAREHOUSE",
    letter: "G",
    label: "Warehouse",
    items: [
      { key: "WAREHOUSE_1", text: "The doors are constantly closed and there are no gaps" },
      { key: "WAREHOUSE_2", text: "Floors are intact" },
      { key: "WAREHOUSE_3", text: "No rust or peeling" },
      { key: "WAREHOUSE_4", text: "Traps and detonators are intact, working and in place" },
      { key: "WAREHOUSE_5", text: "Warehouse Cleanliness" },
      { key: "WAREHOUSE_6", text: "Organizing and stacking packing tasks according to each type" },
      { key: "WAREHOUSE_7", text: "Ensure that the packing tasks are on each supply" },
    ],
  },
  {
    key: "SERVICES",
    letter: "H",
    label: "Services Area",
    items: [
      { key: "SERVICES_1", text: "Cleanliness of the plant's exterior" },
      { key: "SERVICES_2", text: "The presence of garbage bins in their places" },
      { key: "SERVICES_3", text: "Traps and detonators are intact, working and in place" },
      { key: "SERVICES_4", text: "Commitment to the Cleanliness of the Tank" },
      { key: "SERVICES_5", text: "No water leakage" },
      { key: "SERVICES_6", text: "Machine Room Cleaner" },
      { key: "SERVICES_7", text: "Equipment Cleaning" },
      { key: "SERVICES_8", text: "Doors closed" },
      { key: "SERVICES_9", text: "Generator Room Cleaner" },
      { key: "SERVICES_10", text: "Presence of warning signs" },
      { key: "SERVICES_11", text: "Cleanliness of the building's rooms" },
      { key: "SERVICES_12", text: "The cupboards are intact and in good condition" },
      { key: "SERVICES_13", text: "Shoes in designated places" },
      { key: "SERVICES_14", text: "The bathrooms are clean" },
      { key: "SERVICES_15", text: "Commitment to the hygiene of bathrooms" },
    ],
  },
];

const ALL_ITEM_KEYS = new Set(DAILY_CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => i.key)));

export function isValidDailyChecklistItemKey(key: string): boolean {
  return ALL_ITEM_KEYS.has(key);
}

export function totalDailyChecklistItemCount(): number {
  return ALL_ITEM_KEYS.size;
}
