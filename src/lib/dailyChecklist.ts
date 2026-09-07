import type { LabourDepartment } from "@prisma/client";

// Transcribed from the paper "IQF Manager Daily Checklist" form, with a
// handful of OCR/scan typos corrected per the Owner: "Recieving" -> Arrivals
// (matching the Arrival Inspection terminology used elsewhere in the app),
// "blue slotipe" -> Sellotape, "Clarkat drivers" -> Forklift drivers.
// Everything else is kept verbatim since it's the real operational document
// staff are trained against. Section letters C, F, and G were cut off in
// the source photos; they're inferred from the visible A/B/D/E/H sequence.
// textAr/labelAr are a translation of that same verbatim content, not a
// separate source document -- added 2026-09-07 after this page was found to
// be English-only despite the rest of the app's bilingual rollout.
export type DailyChecklistSection = {
  key: string;
  letter: string;
  label: string;
  labelAr: string;
  items: { key: string; text: string; textAr: string }[];
};

export const DAILY_CHECKLIST_SECTIONS: DailyChecklistSection[] = [
  {
    key: "ARRIVALS",
    letter: "A",
    label: "Arrivals Area",
    labelAr: "منطقة الاستلام",
    items: [
      { key: "ARRIVALS_1", text: "Floors are intact, free from defects, rust, or peeling coatings", textAr: "الأرضيات سليمة وخالية من العيوب أو الصدأ أو تقشر الطلاء" },
      { key: "ARRIVALS_2", text: "Pest monitoring devices (traps) are intact, working, and correctly positioned", textAr: "أجهزة مراقبة الآفات (المصائد) سليمة وتعمل وفي أماكنها الصحيحة" },
      { key: "ARRIVALS_3", text: "Arrival area cleanliness is maintained according to hygiene standards", textAr: "يتم الحفاظ على نظافة منطقة الاستلام وفقًا لمعايير النظافة" },
      { key: "ARRIVALS_4", text: "Arrival Supervisor implements all trained arrival instructions/SOPs", textAr: "يلتزم مشرف الاستلام بتطبيق جميع تعليمات وإجراءات الاستلام المُدرَّب عليها" },
      { key: "ARRIVALS_5", text: "Inspection log entries are accurately and completely registered by the supervisor", textAr: "يقوم المشرف بتسجيل بيانات سجل الفحص بدقة واكتمال" },
      { key: "ARRIVALS_6", text: "Empty raw crates are regularly stacked and promptly moved to the de-capping station", textAr: "يتم تكديس الصناديق الفارغة بانتظام ونقلها فورًا إلى محطة نزع التاج" },
      { key: "ARRIVALS_7", text: "Vehicle unloading operations are conducted efficiently, meeting turnaround time targets", textAr: "تتم عمليات تفريغ السيارات بكفاءة وفي إطار الوقت المستهدف" },
    ],
  },
  {
    key: "PRECOOLING",
    letter: "B",
    label: "Pre-cooling Area",
    labelAr: "منطقة التبريد المبدئي",
    items: [
      { key: "PRECOOLING_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "PRECOOLING_2", text: "Raw Feed Hall Temperature 5°C", textAr: "درجة حرارة صالة التغذية الخام 5°م" },
      { key: "PRECOOLING_3", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "PRECOOLING_4", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "PRECOOLING_5", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "PRECOOLING_6", text: "Raw Feed Lounge Cleaner", textAr: "نظافة صالة التغذية الخام" },
      { key: "PRECOOLING_7", text: "Organizing and stacking all pallets in the right way and separating grades and items", textAr: "تنظيم وتكديس جميع الباليتات بالطريقة الصحيحة وفصل الدرجات والأصناف" },
      { key: "PRECOOLING_8", text: "Door rules: never open the outer door while the inner is open, and vice versa", textAr: "قاعدة الأبواب: لا يُفتح الباب الخارجي أثناء فتح الباب الداخلي، والعكس صحيح" },
      { key: "PRECOOLING_9", text: "Workers in the movement of ore and nutrition are committed to walking regularly at all times", textAr: "يلتزم العاملون في نقل المواد الخام بالمشي بانتظام في جميع الأوقات" },
      { key: "PRECOOLING_10", text: "Regular raw feed (no accumulation and no gaps)", textAr: "تغذية خام منتظمة (بدون تكدس أو فجوات)" },
      { key: "PRECOOLING_11", text: "Remove and record all broken crates", textAr: "إزالة وتسجيل جميع الصناديق التالفة" },
    ],
  },
  {
    key: "PRODUCTION",
    letter: "C",
    label: "Production Area",
    labelAr: "منطقة الإنتاج",
    items: [
      { key: "PRODUCTION_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "PRODUCTION_2", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "PRODUCTION_3", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "PRODUCTION_4", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "PRODUCTION_5", text: "Operating Lounge Cleaner", textAr: "نظافة صالة التشغيل" },
      { key: "PRODUCTION_6", text: "Cleaning of wash basin water filters and waste collection in perishable bins", textAr: "تنظيف فلاتر مياه أحواض الغسيل وتجميع المخلفات في صناديق المهملات القابلة للتلف" },
      { key: "PRODUCTION_7", text: "Supervisors and employees adhere to health and safety instructions", textAr: "يلتزم المشرفون والعاملون بتعليمات الصحة والسلامة" },
      { key: "PRODUCTION_8", text: "Operating room temperature 14°C", textAr: "درجة حرارة صالة التشغيل 14°م" },
      { key: "PRODUCTION_9", text: "Matching the temperature of the chiller water to the instructions", textAr: "مطابقة درجة حرارة مياه التبريد للتعليمات" },
      { key: "PRODUCTION_10", text: "Adhere to the colors of the crates for both sorting and executing", textAr: "الالتزام بألوان الصناديق عند الفرز والتنفيذ" },
      { key: "PRODUCTION_11", text: "PCB Calibration", textAr: "معايرة جهاز الكشف عن الملوثات (PCB)" },
      { key: "PRODUCTION_12", text: "Supplier PCB Conformity to the Specification from Data Sheet", textAr: "مطابقة جهاز PCB الخاص بالمورد للمواصفات الواردة في نشرة البيانات" },
      { key: "PRODUCTION_13", text: "Hourly measurement", textAr: "القياس الساعي" },
      { key: "PRODUCTION_14", text: "Chlorine level conforms to customer specification", textAr: "مستوى الكلور مطابق لمواصفات العميل" },
      { key: "PRODUCTION_15", text: "The freezer is clean", textAr: "الفريزر نظيف" },
      { key: "PRODUCTION_16", text: "Clean freezer cleaning tools", textAr: "أدوات تنظيف الفريزر نظيفة" },
      { key: "PRODUCTION_17", text: "No product hanging on the sides of the freezer", textAr: "لا يوجد منتج معلق على جوانب الفريزر" },
      { key: "PRODUCTION_18", text: "Freezer Air Temperature - 40°C", textAr: "درجة حرارة هواء الفريزر -40°م" },
      { key: "PRODUCTION_19", text: "Ammonia Temperature - 44°C", textAr: "درجة حرارة الأمونيا -44°م" },
    ],
  },
  {
    key: "PACKAGING",
    letter: "D",
    label: "Packaging Area",
    labelAr: "منطقة التعبئة",
    items: [
      { key: "PACKAGING_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "PACKAGING_2", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "PACKAGING_3", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "PACKAGING_4", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "PACKAGING_5", text: "Cleaning Packing Hall", textAr: "نظافة صالة التعبئة" },
      { key: "PACKAGING_6", text: "Application of Supervisors and Workers in the Packing Hall to High Care Standards", textAr: "التزام المشرفين والعاملين في صالة التعبئة بمعايير العناية الفائقة" },
      { key: "PACKAGING_7", text: "Packing hall temperature 5°C", textAr: "درجة حرارة صالة التعبئة 5°م" },
      { key: "PACKAGING_8", text: "Finished Product Temperature -18°C", textAr: "درجة حرارة المنتج النهائي -18°م" },
      { key: "PACKAGING_9", text: "Cartons are sealed well and regularly", textAr: "الكراتين مُغلقة بإحكام وبانتظام" },
      { key: "PACKAGING_10", text: "Pallets are well-stacked with correct carton orientation, aligned corners, and a cover on each", textAr: "الباليتات مُكدَّسة جيدًا مع اتجاه صحيح للكراتين وزوايا محاذاة وغطاء على كل باليت" },
      { key: "PACKAGING_11", text: "Fast entry of the final product into refrigerators", textAr: "الإدخال السريع للمنتج النهائي إلى الثلاجات" },
    ],
  },
  {
    key: "COLD_STORES",
    letter: "E",
    label: "Cold Stores",
    labelAr: "الثلاجات",
    items: [
      { key: "COLD_STORES_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "COLD_STORES_2", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "COLD_STORES_3", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "COLD_STORES_4", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "COLD_STORES_5", text: "Refrigerator Cleaner", textAr: "نظافة الثلاجة" },
      { key: "COLD_STORES_6", text: "Operating room temperature -18°C", textAr: "درجة حرارة غرفة التشغيل -18°م" },
      { key: "COLD_STORES_7", text: "Stacking the bits inside the refrigerators regularly according to specifications and production date", textAr: "تكديس الوحدات داخل الثلاجات بانتظام وفقًا للمواصفات وتاريخ الإنتاج" },
      { key: "COLD_STORES_8", text: "All pallets have the lot on them", textAr: "جميع الباليتات مُدوَّن عليها رقم الدفعة" },
      { key: "COLD_STORES_9", text: "Forklift drivers close doors, move safely and steadily, and their alarms work properly.", textAr: "يقوم سائقو الرافعات الشوكية بإغلاق الأبواب والتحرك بأمان وثبات، وتعمل أجهزة الإنذار الخاصة بهم بشكل صحيح." },
    ],
  },
  {
    key: "LOADING",
    letter: "F",
    label: "Loading Area",
    labelAr: "منطقة التحميل",
    items: [
      { key: "LOADING_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "LOADING_2", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "LOADING_3", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "LOADING_4", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "LOADING_5", text: "Loading Room Cleaner", textAr: "نظافة صالة التحميل" },
      { key: "LOADING_6", text: "Container cleanliness and it operates at a temperature of -18°C", textAr: "نظافة الحاوية وتشغيلها بدرجة حرارة -18°م" },
      { key: "LOADING_7", text: "Print the stickers correctly and in the required number", textAr: "طباعة الملصقات بشكل صحيح وبالعدد المطلوب" },
      { key: "LOADING_8", text: "Only one pallet per container; no rushing loading.", textAr: "باليت واحد فقط لكل حاوية؛ دون تسرع في التحميل." },
      { key: "LOADING_9", text: "Safety of cartons and sealing them with blue Sellotape only", textAr: "سلامة الكراتين وإغلاقها بشريط لاصق أزرق فقط" },
      { key: "LOADING_10", text: "The cartons in the container do not exceed the red line", textAr: "الكراتين داخل الحاوية لا تتجاوز الخط الأحمر" },
    ],
  },
  {
    key: "WAREHOUSE",
    letter: "G",
    label: "Warehouse",
    labelAr: "المخازن",
    items: [
      { key: "WAREHOUSE_1", text: "The doors are constantly closed and there are no gaps", textAr: "الأبواب مغلقة باستمرار ولا توجد فجوات" },
      { key: "WAREHOUSE_2", text: "Floors are intact", textAr: "الأرضيات سليمة" },
      { key: "WAREHOUSE_3", text: "No rust or peeling", textAr: "لا يوجد صدأ أو تقشر" },
      { key: "WAREHOUSE_4", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "WAREHOUSE_5", text: "Warehouse Cleanliness", textAr: "نظافة المخزن" },
      { key: "WAREHOUSE_6", text: "Organizing and stacking packing tasks according to each type", textAr: "تنظيم وتكديس مهام التعبئة وفقًا لكل نوع" },
      { key: "WAREHOUSE_7", text: "Ensure that the packing tasks are on each supply", textAr: "التأكد من توفر مستلزمات التعبئة مع كل توريد" },
    ],
  },
  {
    key: "SERVICES",
    letter: "H",
    label: "Services Area",
    labelAr: "منطقة الخدمات",
    items: [
      { key: "SERVICES_1", text: "Cleanliness of the plant's exterior", textAr: "نظافة الواجهة الخارجية للمصنع" },
      { key: "SERVICES_2", text: "The presence of garbage bins in their places", textAr: "وجود صناديق القمامة في أماكنها" },
      { key: "SERVICES_3", text: "Traps and detonators are intact, working and in place", textAr: "المصائد والمفرقعات سليمة وتعمل وفي أماكنها" },
      { key: "SERVICES_4", text: "Commitment to the Cleanliness of the Tank", textAr: "الالتزام بنظافة الخزان" },
      { key: "SERVICES_5", text: "No water leakage", textAr: "لا يوجد تسرب مياه" },
      { key: "SERVICES_6", text: "Machine Room Cleaner", textAr: "نظافة غرفة الماكينات" },
      { key: "SERVICES_7", text: "Equipment Cleaning", textAr: "نظافة المعدات" },
      { key: "SERVICES_8", text: "Doors closed", textAr: "الأبواب مغلقة" },
      { key: "SERVICES_9", text: "Generator Room Cleaner", textAr: "نظافة غرفة المولد" },
      { key: "SERVICES_10", text: "Presence of warning signs", textAr: "وجود لافتات تحذيرية" },
      { key: "SERVICES_11", text: "Cleanliness of the building's rooms", textAr: "نظافة غرف المبنى" },
      { key: "SERVICES_12", text: "The cupboards are intact and in good condition", textAr: "الخزائن سليمة وفي حالة جيدة" },
      { key: "SERVICES_13", text: "Shoes in designated places", textAr: "الأحذية في الأماكن المخصصة" },
      { key: "SERVICES_14", text: "The bathrooms are clean", textAr: "دورات المياه نظيفة" },
      { key: "SERVICES_15", text: "Commitment to the hygiene of bathrooms", textAr: "الالتزام بنظافة دورات المياه" },
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

export function findDailyChecklistSection(sectionKey: string): DailyChecklistSection | undefined {
  return DAILY_CHECKLIST_SECTIONS.find((s) => s.key === sectionKey);
}

// Same green/amber/red scanning convention as cleaningScoreColor -- a quick
// visual read on a 0-10 score.
export function dailyChecklistScoreColor(score: number | null | undefined): string {
  if (score == null) return "text-slate-300";
  if (score >= 8) return "text-emerald-700";
  if (score >= 5) return "text-amber-700";
  return "text-red-700";
}

// Best-effort match against Labour Distribution's departments, so a
// section header can show who's supervising that area this shift without
// re-entering the name here. Cold Stores shares the Load Out department --
// one head (normally Mahmoud) covers storage and load out together, so
// whoever Daily Report has recorded as the Load Out supervisor that shift
// (Mahmoud, or a stand-in when he's out) carries over to both sections.
// Warehouse has no supervisor at all, so it's left unmapped.
export const DAILY_CHECKLIST_SECTION_LABOUR_DEPARTMENT: Partial<Record<string, LabourDepartment>> = {
  ARRIVALS: "INTAKE",
  PRECOOLING: "INFEED",
  PRODUCTION: "PROCESSING",
  PACKAGING: "PACKAGING",
  COLD_STORES: "LOAD_OUT",
  LOADING: "LOAD_OUT",
  SERVICES: "MAINTENANCE_ENGINEERING",
};
