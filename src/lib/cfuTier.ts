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

// Every tier below is a genuinely different hue family -- not a repeated
// color at a different shade -- specifically so two tiers can never be
// mistaken for each other even at a glance. The old ramp (before this) was
// itself a fix for pale near-duplicates, but still repeated one hue (red)
// across five separate tiers; this version never reuses a hue at all. Order
// still runs cool-to-hot so severity reads roughly right on sight, starting
// on green (safe, the one universally-understood anchor worth keeping) and
// ending on red immediately before REJECT's solid black -- the worst
// graduated tier should still look the most alarming, not the most colorful.
export const CFU_TIERS: CfuTier[] = [
  { min: 0, max: 10_000, label: "< 10,000 cfu/g", bg: "bg-green-600", text: "text-white", hex: "#16a34a", textHex: "#ffffff" },
  { min: 10_000, max: 20_000, label: "10,000–20,000 cfu/g", bg: "bg-teal-600", text: "text-white", hex: "#0d9488", textHex: "#ffffff" },
  { min: 20_000, max: 30_000, label: "20,000–30,000 cfu/g", bg: "bg-cyan-600", text: "text-white", hex: "#0891b2", textHex: "#ffffff" },
  { min: 30_000, max: 40_000, label: "30,000–40,000 cfu/g", bg: "bg-blue-600", text: "text-white", hex: "#2563eb", textHex: "#ffffff" },
  { min: 40_000, max: 50_000, label: "40,000–50,000 cfu/g", bg: "bg-violet-600", text: "text-white", hex: "#7c3aed", textHex: "#ffffff" },
  { min: 50_000, max: 60_000, label: "50,000–60,000 cfu/g", bg: "bg-fuchsia-600", text: "text-white", hex: "#c026d3", textHex: "#ffffff" },
  { min: 60_000, max: 70_000, label: "60,000–70,000 cfu/g", bg: "bg-yellow-600", text: "text-yellow-950", hex: "#ca8a04", textHex: "#422006" },
  { min: 70_000, max: 80_000, label: "70,000–80,000 cfu/g", bg: "bg-amber-600", text: "text-amber-950", hex: "#d97706", textHex: "#451a03" },
  { min: 80_000, max: 90_000, label: "80,000–90,000 cfu/g", bg: "bg-orange-600", text: "text-white", hex: "#ea580c", textHex: "#ffffff" },
  { min: 90_000, max: 100_000, label: "90,000–100,000 cfu/g", bg: "bg-red-600", text: "text-white", hex: "#dc2626", textHex: "#ffffff" },
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
