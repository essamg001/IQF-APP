// Total/Aerobic Plate Count (cfu/g) severity tiers -- replaces the old flat
// ">10,000 = reject" rule with 10 graduated bands (one per 10,000 cfu/g, up
// to 100,000), since different clients tolerate different levels. A pallet
// can be lab-APPROVED (both labs signed off, eligible to ship at all) and
// still carry a specific tier here -- the tier says which clients it's
// actually suitable for, it doesn't replace the pass/fail gate.
//
// Colors deliberately form a severity ramp (green -> ... -> black), not a
// single-hue sequential scale, per the owner's own anchors (green/yellow/
// orange/red/black) -- every tier is always shown with its numeric label
// alongside the color, never color-alone.

export type CfuTier = {
  /** Inclusive lower bound, in cfu/g. */
  min: number;
  /** Exclusive upper bound, in cfu/g (null = open-ended). */
  max: number | null;
  label: string;
  bg: string;
  text: string;
  /** Same color as bg/text, as hex -- for surfaces that can't use Tailwind classes (e.g. the certificate's inline-styled document). */
  hex: string;
  textHex: string;
};

// Every color below sits at Tailwind's "600" weight (or the matching dark
// step for the reject-adjacent reds) specifically so no two tiers are just
// lighter/darker shades of the same pastel -- the previous ramp packed
// green-100/lime-200/yellow-300 into near-identical pale tones, and put
// 90,000-100,000 and REJECT on the exact same black, indistinguishable in
// the legend swatch. Five tiers each get their own hue (green/lime/yellow/
// amber/orange) at matched saturation so they read as genuinely different
// colors, not gradations; the remaining five darken through one red family
// (a real severity ramp, not meant to be told apart by hue); REJECT is the
// only tier that's actually solid black.
export const CFU_TIERS: CfuTier[] = [
  { min: 0, max: 10_000, label: "< 10,000 cfu/g", bg: "bg-green-600", text: "text-white", hex: "#16a34a", textHex: "#ffffff" },
  { min: 10_000, max: 20_000, label: "10,000–20,000 cfu/g", bg: "bg-lime-600", text: "text-lime-950", hex: "#65a30d", textHex: "#1a2e05" },
  { min: 20_000, max: 30_000, label: "20,000–30,000 cfu/g", bg: "bg-yellow-600", text: "text-yellow-950", hex: "#ca8a04", textHex: "#422006" },
  { min: 30_000, max: 40_000, label: "30,000–40,000 cfu/g", bg: "bg-amber-600", text: "text-white", hex: "#d97706", textHex: "#ffffff" },
  { min: 40_000, max: 50_000, label: "40,000–50,000 cfu/g", bg: "bg-orange-600", text: "text-white", hex: "#ea580c", textHex: "#ffffff" },
  { min: 50_000, max: 60_000, label: "50,000–60,000 cfu/g", bg: "bg-red-600", text: "text-white", hex: "#dc2626", textHex: "#ffffff" },
  { min: 60_000, max: 70_000, label: "60,000–70,000 cfu/g", bg: "bg-red-700", text: "text-white", hex: "#b91c1c", textHex: "#ffffff" },
  { min: 70_000, max: 80_000, label: "70,000–80,000 cfu/g", bg: "bg-red-800", text: "text-white", hex: "#991b1b", textHex: "#ffffff" },
  { min: 80_000, max: 90_000, label: "80,000–90,000 cfu/g", bg: "bg-red-900", text: "text-white", hex: "#7f1d1d", textHex: "#ffffff" },
  { min: 90_000, max: 100_000, label: "90,000–100,000 cfu/g", bg: "bg-red-950", text: "text-white", hex: "#450a0a", textHex: "#ffffff" },
];

/** Above the graduated system entirely -- an automatic hard reject regardless of client. The only tier that's actually black, so it never reads as "just another dark red" next to 90,000-100,000. */
export const CFU_REJECT_TIER: CfuTier = {
  min: 100_000,
  max: null,
  label: "> 100,000 cfu/g — REJECT",
  bg: "bg-black",
  text: "text-red-400",
  hex: "#000000",
  textHex: "#f87171",
};

export function cfuTierFor(cfuValue: number): CfuTier {
  if (cfuValue >= 100_000) return CFU_REJECT_TIER;
  return CFU_TIERS.find((t) => cfuValue >= t.min && cfuValue < (t.max ?? Infinity)) ?? CFU_REJECT_TIER;
}

type MicroResultWithCfu = { totalPlateCountCfuG: number | null };

/**
 * The higher (worse) of the two labs' reported cfu/g values -- a pallet is
 * only as good as its worst result, per the owner's own rule, so it never
 * ships to a client stricter than what either lab actually measured.
 * Returns null when neither lab has reported a number yet.
 */
export function combinedCfuValue(results: MicroResultWithCfu[]): number | null {
  const values = results.map((r) => r.totalPlateCountCfuG).filter((v): v is number => v != null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

export function exceedsClientLimit(cfuValue: number, maxCfuPerGram: number | null | undefined): boolean {
  if (maxCfuPerGram == null) return false;
  return cfuValue > maxCfuPerGram;
}
