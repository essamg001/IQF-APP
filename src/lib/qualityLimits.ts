// Every numeric tolerance printed on the real inspection forms (STR03101,
// STR03107, STR03110, STR03111/STR03116, STR03118/STR03119), in one place, so
// a single check can flag out-of-spec values consistently across every
// checkpoint. Ranges (min+max together) cover things like PH;
// ceilings/floors cover defect percentages and quality minimums.
import type { QualityCheckpoint, Grade, Format, Locale } from "@prisma/client";

export type LimitRule = { field: string; label: string; min?: number; max?: number };
export type LimitViolation = { label: string; value: number; min?: number; max?: number };

const PRE_DECAP_LIMITS: LimitRule[] = [
  { field: "brix", label: "Brix", min: 7 },
  { field: "productTemperatureC", label: "Temperature", min: 30 },
  { field: "fruitColorPct", label: "Berry Colour", min: 85 },
  { field: "internalQualityPct", label: "Internal Quality", max: 10 },
  { field: "overmaturePct", label: "Over Maturity", max: 50 },
  { field: "diameterUnder22mmPct", label: "Diameter <22mm", max: 10 },
  { field: "botrytisPct", label: "Botrytis", max: 10 },
  { field: "earlyBotrytisPct", label: "Early Botrytis", max: 1 },
  { field: "pestDiseasePct", label: "Pest/Disease", max: 10 },
  { field: "insectDamagePct", label: "Insect Damage", max: 5 },
  { field: "wormEatenPct", label: "Worm-Eaten", max: 10 },
  { field: "birdTracesPct", label: "Bird Traces", max: 5 },
  { field: "leavesStalksPct", label: "Leaves/Stalks", max: 5 },
  { field: "bruisesPct", label: "Bruises", max: 20 },
  { field: "shapeDeformitiesPct", label: "Mishape", max: 50 },
  { field: "sandDustPct", label: "Sand", max: 15 },
  { field: "foreignBodiesPct", label: "Foreign Bodies", max: 0 },
  { field: "totalDefectsPct", label: "Total Defects", max: 60 },
];

// Shared by both RAW_MATERIAL (STR03110, Arrival Inspection at Factory) and
// POST_DECAP (STR03107, Post-Decap Quality) -- same defect checklist, same limits.
const DECAP_SHARED_LIMITS: LimitRule[] = [
  { field: "crateWeightKg", label: "Crate Weight", min: 3.3, max: 3.7 },
  { field: "leafStemRemainsCount", label: "Leaf/Stem Remains", max: 1 },
  { field: "fruitColorPct", label: "Fruit Colour", min: 90 },
  { field: "internalQualityPct", label: "Internal Quality", max: 3 },
  { field: "incompleteMaturityPct", label: "Incomplete Maturity", max: 1 },
  { field: "moldSignsPct", label: "Mold Signs", max: 1 },
  { field: "mouldPct", label: "Mould", max: 0 },
  { field: "capsuleRemainsPct", label: "Capsule Remains", max: 2 },
  { field: "birdFoodPct", label: "Bird Food", max: 2 },
  { field: "overmaturePct", label: "Overmature", max: 5 },
  { field: "skinDamagePct", label: "Skin Deformities", max: 2 },
  { field: "shapeDeformitiesPct", label: "Shape Deformities", max: 3 },
  { field: "seedClusteringPct", label: "Seed Clustering", max: 1 },
  { field: "bruisesPct", label: "Bruises", max: 1 },
  { field: "dryCavitiesPct", label: "Dry Cavities", max: 1 },
  { field: "overDecappingPct", label: "Over-Decapping", max: 1 },
  { field: "oxidationPct", label: "Oxidation", max: 4 },
  { field: "sandDustPct", label: "Sand/Dust", max: 1 },
  { field: "insectsLarvaePct", label: "Insects/Larvae", max: 0 },
  { field: "foreignBodiesPct", label: "Foreign Bodies", max: 0 },
  { field: "brokenUncleanPalletsPct", label: "Broken/Unclean Pallets", max: 0 },
  { field: "unfumigatedPalletsPct", label: "Unfumigated Pallets", max: 0 },
  { field: "brokenUncleanCratesPct", label: "Broken/Unclean Crates", max: 0 },
];

const RAW_MATERIAL_LIMITS: LimitRule[] = [
  ...DECAP_SHARED_LIMITS,
  { field: "productTemperatureC", label: "Temperature", max: 10 },
  { field: "acidityPh", label: "PH", min: 3.1, max: 3.5 },
  { field: "totalDefectsPct", label: "Total Defects", max: 5 },
];
const POST_DECAP_LIMITS: LimitRule[] = [
  ...DECAP_SHARED_LIMITS,
  { field: "brix", label: "Brix", min: 7 },
  { field: "totalDefectsPct", label: "Total Defects", max: 6 },
];

// Process-control checks on Post-Freeze Inspection (STR03111/STR03116/
// STR03118/STR03119) that don't vary by grade or format -- sample-handling
// and cold-chain constants, not fruit-quality grading criteria.
const POST_FREEZE_PROCESS_LIMITS: LimitRule[] = [
  { field: "acidityPh", label: "PH", min: 3.1, max: 3.5 },
  { field: "sampleWeightKg", label: "Sample Weight", min: 2 },
  { field: "productTemperatureC", label: "Product Temperature", max: -18 },
  { field: "capsuleRemainsCount", label: "Capsule Remains", max: 10 },
  { field: "leafRemainsCount", label: "Leaf Remains", max: 10 },
  { field: "stemFragmentsCount", label: "Stem Fragments", max: 1 },
  { field: "frozenProductWaitMinutes", label: "Frozen Product Waiting Period", min: 10, max: 30 },
];

// STR03111 (Grade A) / STR03116 (Grade B) -- same checklist, tighter tolerances for A.
const POST_PACKAGING_LIMITS: Record<Grade, LimitRule[]> = {
  A: [
    ...POST_FREEZE_PROCESS_LIMITS,
    { field: "fruitColorPct", label: "Fruit Colour", min: 90 },
    { field: "overmaturePct", label: "Overmature", max: 3 },
    { field: "incompleteMaturityPct", label: "Incomplete Maturity", max: 3 },
    { field: "shapeDeformitiesPct", label: "Shape Deformities", max: 3 },
    { field: "skinDamagePct", label: "Skin Deformities", max: 2 },
    { field: "cohesiveClustersPct", label: "Cohesive Clusters", max: 2 },
    { field: "crushedBrokenFruitPct", label: "Crushed/Broken Fruit", max: 2 },
    { field: "dryBruisesPct", label: "Dry Bruises", max: 1 },
    { field: "mechanicalFactorsPct", label: "Mechanical Factors", max: 2 },
    { field: "oxidationPct", label: "Oxidation", max: 4 },
    { field: "totalDefectsPct", label: "Total Defects", max: 5 },
    { field: "internalQualityPct", label: "Internal Quality", max: 3 },
    { field: "fungalInfectionPct", label: "Fungal Infection", max: 0 },
    { field: "insectsLarvaePct", label: "Insects/Larvae", max: 0 },
    { field: "insectInfestationPct", label: "Insect Infestation", max: 0 },
    { field: "foreignBodiesPct", label: "Foreign Bodies", max: 0 },
  ],
  B: [
    ...POST_FREEZE_PROCESS_LIMITS,
    { field: "fruitColorPct", label: "Fruit Colour", min: 80 },
    { field: "overmaturePct", label: "Overmature", max: 5 },
    { field: "incompleteMaturityPct", label: "Incomplete Maturity", max: 5 },
    { field: "shapeDeformitiesPct", label: "Shape Deformities", max: 5 },
    { field: "skinDamagePct", label: "Skin Deformities", max: 3 },
    { field: "cohesiveClustersPct", label: "Cohesive Clusters", max: 3 },
    { field: "crushedBrokenFruitPct", label: "Crushed/Broken Fruit", max: 3 },
    { field: "dryBruisesPct", label: "Dry Bruises", max: 2 },
    { field: "mechanicalFactorsPct", label: "Mechanical Factors", max: 2 },
    { field: "oxidationPct", label: "Oxidation", max: 6 },
    { field: "totalDefectsPct", label: "Total Defects", max: 10 },
    { field: "internalQualityPct", label: "Internal Quality", max: 3 },
    { field: "fungalInfectionPct", label: "Fungal Infection", max: 0 },
    { field: "insectsLarvaePct", label: "Insects/Larvae", max: 0 },
    { field: "insectInfestationPct", label: "Insect Infestation", max: 0 },
    { field: "foreignBodiesPct", label: "Foreign Bodies", max: 0 },
  ],
};

// STR03118 (Sliced) / STR03119 (Diced) -- one spec each, not grade-split like
// whole fruit. Numerically identical to each other (only the "broken" item's
// real-world meaning differs -- slices vs cubes), kept as separate constants
// anyway since they mirror two separate paper forms with their own labels.
const POST_PACKAGING_SLICED_LIMITS: LimitRule[] = [
  ...POST_FREEZE_PROCESS_LIMITS,
  { field: "fruitColorPct", label: "Fruit Colour", min: 90 },
  { field: "overmaturePct", label: "Overmature", max: 2 },
  { field: "incompleteMaturityPct", label: "Incomplete Maturity", max: 2 },
  { field: "shapeDeformitiesPct", label: "Shape Deformities", max: 3 },
  { field: "skinDamagePct", label: "Skin Deformities", max: 2 },
  { field: "cohesiveClustersPct", label: "Cohesive Clusters", max: 5 },
  { field: "crushedBrokenFruitPct", label: "Broken/Crushed Slices", max: 20 },
  { field: "dryBruisesPct", label: "Dry Bruises", max: 1 },
  { field: "mechanicalFactorsPct", label: "Mechanical Factors", max: 2 },
  { field: "oxidationPct", label: "Oxidation", max: 2 },
  { field: "totalDefectsPct", label: "Total Defects", max: 10 },
  { field: "internalQualityPct", label: "Internal Quality", max: 3 },
  { field: "fungalInfectionPct", label: "Fungal Infection", max: 0 },
  { field: "insectsLarvaePct", label: "Insects/Larvae", max: 0 },
  { field: "insectInfestationPct", label: "Insect Infestation", max: 0 },
  { field: "foreignBodiesPct", label: "Foreign Bodies", max: 0 },
];

const POST_PACKAGING_DICED_LIMITS: LimitRule[] = POST_PACKAGING_SLICED_LIMITS.map((rule) =>
  rule.field === "crushedBrokenFruitPct" ? { ...rule, label: "Irregular/Broken Cubes" } : rule
);

// Every distinct English `label` used anywhere above, translated for display
// on the /quality and /quality-check report pages (the only consumers that
// show these as UI chrome -- violation/trend-warning message text stays
// English like every other server-action string in this app). Keyed by the
// English label itself rather than `field`, since a few fields (e.g.
// crushedBrokenFruitPct) carry a different label depending on format/grade.
const LABEL_AR: Record<string, string> = {
  "Berry Colour": "لون الثمرة",
  "Bird Food": "أثر تغذية الطيور",
  "Bird Traces": "آثار الطيور",
  Botrytis: "العفن الرمادي",
  Brix: "بريكس",
  "Broken/Crushed Slices": "شرائح مكسورة/مهروسة",
  "Broken/Unclean Crates": "صناديق مكسورة/غير نظيفة",
  "Broken/Unclean Pallets": "باليتات مكسورة/غير نظيفة",
  Bruises: "كدمات",
  "Capsule Remains": "بقايا الكأس",
  "Cohesive Clusters": "عناقيد متلاصقة",
  "Crate Weight": "وزن الصندوق",
  "Crushed/Broken Fruit": "ثمار مهروسة/مكسورة",
  "Diameter <22mm": "القطر أقل من 22 مم",
  "Dry Bruises": "كدمات جافة",
  "Dry Cavities": "تجاويف جافة",
  "Early Botrytis": "العفن الرمادي المبكر",
  "Foreign Bodies": "أجسام غريبة",
  "Frozen Product Waiting Period": "فترة انتظار المنتج المجمد",
  "Fruit Colour": "لون الثمرة",
  "Fungal Infection": "عدوى فطرية",
  "Incomplete Maturity": "نضج غير مكتمل",
  "Insect Damage": "ضرر الحشرات",
  "Insect Infestation": "إصابة حشرية",
  "Insects/Larvae": "حشرات/يرقات",
  "Internal Quality": "الجودة الداخلية",
  "Irregular/Broken Cubes": "مكعبات غير منتظمة/مكسورة",
  "Leaf Remains": "بقايا أوراق",
  "Leaf/Stem Remains": "بقايا أوراق/سيقان",
  "Leaves/Stalks": "أوراق/سيقان",
  "Mechanical Factors": "عوامل ميكانيكية",
  Mishape: "تشوه الشكل",
  "Mold Signs": "علامات العفن",
  Mould: "عفن",
  "Over Maturity": "فرط النضج",
  "Over-Decapping": "إفراط في إزالة الكأس",
  Overmature: "مفرط النضج",
  Oxidation: "أكسدة",
  PH: "الحموضة PH",
  "Pest/Disease": "آفات/أمراض",
  "Product Temperature": "درجة حرارة المنتج",
  "Sample Weight": "وزن العينة",
  Sand: "رمل",
  "Sand/Dust": "رمل/غبار",
  "Seed Clustering": "تكتل البذور",
  "Shape Deformities": "تشوهات الشكل",
  "Skin Deformities": "تشوهات القشرة",
  "Stem Fragments": "أجزاء سيقان",
  Temperature: "درجة الحرارة",
  "Total Defects": "إجمالي العيوب",
  "Unfumigated Pallets": "باليتات غير مبخرة",
  "Worm-Eaten": "متآكل بالديدان",
};

/** Translates a `LimitRule`/`LimitViolation` label for display -- English labels pass through unchanged for AR if no translation is on file, rather than showing blank. */
export function translateLabel(label: string, locale: Locale): string {
  return locale === "AR" ? (LABEL_AR[label] ?? label) : label;
}

export function limitsFor(checkpoint: QualityCheckpoint, grade?: Grade, format?: Format): LimitRule[] {
  switch (checkpoint) {
    case "PRE_DECAP":
      return PRE_DECAP_LIMITS;
    case "RAW_MATERIAL":
      return RAW_MATERIAL_LIMITS;
    case "POST_DECAP":
      return POST_DECAP_LIMITS;
    case "POST_PACKAGING":
      if (format === "SLICED") return POST_PACKAGING_SLICED_LIMITS;
      if (format === "DICED") return POST_PACKAGING_DICED_LIMITS;
      return POST_PACKAGING_LIMITS[grade ?? "A"];
  }
}

/** Checks a saved check's values against its checkpoint's limits and returns every band that's out of spec. */
export function checkQualityLimits(
  checkpoint: QualityCheckpoint,
  values: Record<string, unknown>,
  grade?: Grade,
  format?: Format
): LimitViolation[] {
  const violations: LimitViolation[] = [];
  for (const rule of limitsFor(checkpoint, grade, format)) {
    const value = values[rule.field];
    if (typeof value !== "number") continue;
    if ((rule.max != null && value > rule.max) || (rule.min != null && value < rule.min)) {
      violations.push({ label: rule.label, value, min: rule.min, max: rule.max });
    }
  }
  return violations;
}

export function formatViolation(v: LimitViolation): string {
  const limit = v.max != null ? `limit ≤${v.max}` : `limit ≥${v.min}`;
  return `${v.label} ${v.value} (${limit})`;
}

// Arabic sentence wrapper -- the field label itself (e.g. "Brix",
// "Temperature") stays as-is rather than being translated, same policy as
// every other identifier/technical-field-name in this app's bilingual
// alert text (see formatViolationAr's caller in alerts.ts).
export function formatViolationAr(v: LimitViolation): string {
  const limit = v.max != null ? `الحد الأقصى ≤${v.max}` : `الحد الأدنى ≥${v.min}`;
  return `${v.label} ${v.value} (${limit})`;
}

/**
 * Encodes a server action's success result -- the computed decision plus any
 * limit violations -- into the single string these forms' useActionState
 * hooks return. Decision always travels alongside violations rather than
 * being re-derived client-side from `violations.length === 0`, since at
 * least one checkpoint (a whole-delivery rejection on Arrival Inspection)
 * can be REJECTED with zero violations (no per-defect sampling happens, so
 * there's nothing to check against a limit).
 */
export function encodeActionResult(id: string, decision: "ACCEPTED" | "REJECTED", violations: LimitViolation[]): string {
  if (violations.length === 0) return `ok:${id}:${decision}`;
  return `ok:${id}:${decision}::${JSON.stringify(violations)}`;
}

export function decodeActionResult(state: string): { id: string; decision: "ACCEPTED" | "REJECTED"; violations: LimitViolation[] } | null {
  if (!state.startsWith("ok:")) return null;
  const rest = state.slice(3);
  const sep = rest.indexOf("::");
  const head = sep === -1 ? rest : rest.slice(0, sep);
  const [id, decision] = head.split(":") as [string, "ACCEPTED" | "REJECTED"];
  const violations = sep === -1 ? [] : JSON.parse(rest.slice(sep + 2));
  return { id, decision, violations };
}

export type TrendWarning = { label: string; recentValues: number[]; limit: LimitRule };

/**
 * Flags a metric that hasn't breached its limit yet but is heading there --
 * its last 3 readings for this field are strictly moving toward the limit
 * (not just noisy) and are already within 30% of it. Zero-tolerance limits
 * (max: 0) are excluded since there's no "approaching" a limit that any
 * nonzero reading already breaches outright.
 *
 * `recentChecksChronological` must be the field's last 3 checks for this
 * checkpoint, oldest first (including the one just saved).
 */
export function checkFieldTrend(
  recentChecksChronological: Record<string, unknown>[],
  checkpoint: QualityCheckpoint,
  grade?: Grade
): TrendWarning[] {
  if (recentChecksChronological.length < 3) return [];
  const lastThree = recentChecksChronological.slice(-3);
  const warnings: TrendWarning[] = [];

  for (const rule of limitsFor(checkpoint, grade)) {
    if (rule.max === 0) continue;
    const values = lastThree.map((c) => c[rule.field]).filter((v): v is number => typeof v === "number");
    if (values.length < 3) continue;
    const [v1, v2, v3] = values;
    const avg3 = (v1 + v2 + v3) / 3;

    if (rule.max != null && v1 < v2 && v2 < v3 && avg3 >= rule.max * 0.7) {
      warnings.push({ label: rule.label, recentValues: values, limit: rule });
    } else if (rule.min != null && v1 > v2 && v2 > v3 && avg3 <= rule.min * 1.15) {
      warnings.push({ label: rule.label, recentValues: values, limit: rule });
    }
  }
  return warnings;
}

export function formatTrendWarning(w: TrendWarning): string {
  const limitText = w.limit.max != null ? `limit ≤${w.limit.max}` : `limit ≥${w.limit.min}`;
  return `${w.label} trending toward its limit: ${w.recentValues.map((v) => v.toFixed(1)).join(" → ")} (${limitText})`;
}

export function formatTrendWarningAr(w: TrendWarning): string {
  const limitText = w.limit.max != null ? `الحد الأقصى ≤${w.limit.max}` : `الحد الأدنى ≥${w.limit.min}`;
  return `${w.label} يتجه نحو حده: ${w.recentValues.map((v) => v.toFixed(1)).join(" ← ")} (${limitText})`;
}
