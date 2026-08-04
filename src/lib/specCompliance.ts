// Checks a pallet's actual post-packaging measurements against a specific
// client's own spec sheet (src/lib/validation/client.ts's DEFECT_FIELDS, plus
// brix) -- the same client's spec that governs allocation/load-out/the
// certificate, so all three read the exact same verdict from this one place.
//
// Client spec tolerances are free text across 32 real clients, and the real
// data is genuinely messy: mixed units (%, pcs/10kg, pcs/kg, pcs/100kg),
// combined categories ("same as Damage above"), Red/Amber/Green banded
// thresholds, and the literal placeholder text "notes". The parser below
// only ever recognizes the common simple forms and returns null (meaning:
// not automatically enforceable, shown for manual review only) for anything
// else -- it never guesses, the same way parseBrixRange already treats
// unparseable brix text.
//
// Likewise, not every defect field has a matching measured value on
// QualityCheck today -- blemish, dry pump, rotten, dead worm, and unripe have
// no dedicated post-packaging field, so there's nothing to compare the
// client's tolerance against. Those stay informational-only.

import { parseBrixRange } from "@/lib/allocation";

export type SpecComplianceRow = {
  key: string;
  label: string;
  measuredValue: number | null;
  measuredUnit: string;
  specText: string | null;
  /** Human-readable parsed limit, for display (e.g. "≤ 2%", "8–11 °Bx") -- null if unparseable/no spec. */
  specLimitDisplay: string | null;
  /** False when there's no measured field for this parameter at all, or the spec text didn't parse -- shown, never blocks. */
  enforceable: boolean;
  violated: boolean;
};

export type QualityCheckForSpec = {
  brix: number;
  overmaturePct: number | null;
  capsuleRemainsCount: number | null;
  leafRemainsCount: number | null;
  stemFragmentsCount: number | null;
  shapeDeformitiesPct: number | null;
  cohesiveClustersPct: number | null;
  crushedBrokenFruitPct: number | null;
  oxidationPct: number | null;
  mechanicalFactorsPct: number | null;
  internalQualityPct: number | null;
  insectInfestationPct: number | null;
};

export type ClientSpecForSpec = {
  brix: string | null;
  overripe: string | null;
  unripe: string | null;
  calyx: string | null;
  leaves: string | null;
  stems: string | null;
  misshapen: string | null;
  blemish: string | null;
  dryPump: string | null;
  clumps: string | null;
  broken: string | null;
  oxidation: string | null;
  mechanicalDamage: string | null;
  rotten: string | null;
  insectDamage: string | null;
  internalQuality: string | null;
  deadWorm: string | null;
};

type CeilingField = {
  key: keyof ClientSpecForSpec;
  label: string;
  measuredKey: keyof QualityCheckForSpec;
  unit: "%" | "pcs/10kg";
};

// Fields with no reliable post-packaging measurement to compare against --
// still shown on the cert with their spec text, never enforced.
const UNENFORCEABLE_FIELDS: { key: keyof ClientSpecForSpec; label: string }[] = [
  { key: "unripe", label: "Unripe" },
  { key: "blemish", label: "Blemish" },
  { key: "dryPump", label: "Dry Pump" },
  { key: "rotten", label: "Rotten" },
  { key: "deadWorm", label: "Dead Worm" },
];

const CEILING_FIELDS: CeilingField[] = [
  { key: "overripe", label: "Over-ripe", measuredKey: "overmaturePct", unit: "%" },
  { key: "calyx", label: "Calyx", measuredKey: "capsuleRemainsCount", unit: "pcs/10kg" },
  { key: "leaves", label: "Leaves", measuredKey: "leafRemainsCount", unit: "pcs/10kg" },
  { key: "stems", label: "Stems", measuredKey: "stemFragmentsCount", unit: "pcs/10kg" },
  { key: "misshapen", label: "Misshapen", measuredKey: "shapeDeformitiesPct", unit: "%" },
  { key: "clumps", label: "Clumps", measuredKey: "cohesiveClustersPct", unit: "%" },
  { key: "broken", label: "Broken", measuredKey: "crushedBrokenFruitPct", unit: "%" },
  { key: "oxidation", label: "Oxidation", measuredKey: "oxidationPct", unit: "%" },
  { key: "mechanicalDamage", label: "Mechanical Damage", measuredKey: "mechanicalFactorsPct", unit: "%" },
  { key: "insectDamage", label: "Insect Damage", measuredKey: "insectInfestationPct", unit: "%" },
  { key: "internalQuality", label: "Internal Quality", measuredKey: "internalQualityPct", unit: "%" },
];

/** Strict, whole-string percentage ceiling parser -- e.g. "2%", "5% max", "Max 5%", "<7% by weight". Never matches combined/banded/descriptive text. */
function parsePercentCeiling(text: string): number | null {
  const t = text.trim();
  if (t === "*") return null;
  let m = t.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (m) return Number(m[1]);
  m = t.match(/^(?:max\.?\s*)?(\d+(?:\.\d+)?)\s*%\s*max$/i);
  if (m) return Number(m[1]);
  m = t.match(/^max\.?\s*(\d+(?:\.\d+)?)\s*%$/i);
  if (m) return Number(m[1]);
  m = t.match(/^<\s*(\d+(?:\.\d+)?)\s*%(?:\s*by\s*(?:weight|count))?$/i);
  if (m) return Number(m[1]);
  return null;
}

/** Strict count/weight ceiling parser, normalized to a pcs/10kg basis -- e.g. "3pcs/10kg", "4pcs/kg", "6/100kg". */
function parseCountCeiling(text: string): number | null {
  const t = text.trim();
  if (t === "*") return null;
  const m = t.match(/^(\d+(?:\.\d+)?)\s*p?c?s?\s*[/\\]\s*(\d+(?:\.\d+)?)?\s*kg$/i);
  if (!m) return null;
  const count = Number(m[1]);
  const denomKg = m[2] ? Number(m[2]) : 1;
  if (denomKg <= 0) return null;
  return count * (10 / denomKg);
}

function parseCeiling(text: string, unit: "%" | "pcs/10kg"): number | null {
  return unit === "%" ? parsePercentCeiling(text) : parseCountCeiling(text);
}

function formatCeiling(ceiling: number, unit: "%" | "pcs/10kg"): string {
  return unit === "%" ? `≤ ${ceiling}%` : `≤ ${ceiling} pcs/10kg`;
}

/**
 * Evaluates every spec parameter for one pallet's measured values against one
 * client spec. `check` is the pallet's (or its lot's, per the existing
 * fallback in src/lib/palletQuality.ts) latest POST_PACKAGING QualityCheck --
 * pass null if none has been logged yet (every row comes back
 * enforceable:false, measuredValue:null). `spec` is the matching ClientSpec
 * for the destination client + grade + format -- pass null if the client has
 * no spec on file for this grade/format at all.
 */
export function evaluateSpecCompliance(
  check: QualityCheckForSpec | null,
  spec: ClientSpecForSpec | null
): SpecComplianceRow[] {
  const rows: SpecComplianceRow[] = [];

  const brixRange = spec?.brix ? parseBrixRange(spec.brix) : null;
  const brixValue = check?.brix ?? null;
  rows.push({
    key: "brix",
    label: "Brix",
    measuredValue: brixValue,
    measuredUnit: "°Bx",
    specText: spec?.brix ?? null,
    specLimitDisplay: brixRange ? `${brixRange.min}–${brixRange.max} °Bx` : null,
    enforceable: brixRange !== null && brixValue !== null,
    violated: !!(brixRange && brixValue !== null && (brixValue < brixRange.min || brixValue > brixRange.max)),
  });

  for (const field of CEILING_FIELDS) {
    const specText = spec?.[field.key] ?? null;
    const measuredValue = check?.[field.measuredKey] ?? null;
    const ceiling = specText ? parseCeiling(specText, field.unit) : null;
    const enforceable = ceiling !== null && measuredValue !== null;
    rows.push({
      key: field.key,
      label: field.label,
      measuredValue,
      measuredUnit: field.unit,
      specText,
      specLimitDisplay: ceiling !== null ? formatCeiling(ceiling, field.unit) : null,
      enforceable,
      violated: enforceable && measuredValue! > ceiling!,
    });
  }

  for (const field of UNENFORCEABLE_FIELDS) {
    rows.push({
      key: field.key,
      label: field.label,
      measuredValue: null,
      measuredUnit: "",
      specText: spec?.[field.key] ?? null,
      specLimitDisplay: null,
      enforceable: false,
      violated: false,
    });
  }

  return rows;
}

/** Just the parameters that actually fail spec -- the shape every gating call site needs. */
export function violatedSpecRows(rows: SpecComplianceRow[]): SpecComplianceRow[] {
  return rows.filter((r) => r.enforceable && r.violated);
}

// The exact structured payload a blocked load attempt encodes into its
// returned string (prefixed so the client form can tell it apart from a
// plain error message) -- lets the load-out screen render a "sign off to
// load anyway" form for the specific violations found, without a second
// round trip to re-fetch them. Lives here (not in the "use server" actions
// file) since a "use server" file can only export async functions.
export type SpecBlockPayload = {
  palletId: string;
  palletNumber: string;
  lotNumber: string;
  containerId: string;
  quantityTonnes: number;
  clientName: string;
  violations: { key: string; label: string; measuredDisplay: string; specLimitDisplay: string }[];
};
const SPEC_BLOCK_PREFIX = "SPEC_BLOCKED::";

export function encodeSpecBlock(payload: SpecBlockPayload): string {
  return SPEC_BLOCK_PREFIX + JSON.stringify(payload);
}

export function decodeSpecBlock(state: string | undefined): SpecBlockPayload | null {
  if (!state?.startsWith(SPEC_BLOCK_PREFIX)) return null;
  try {
    return JSON.parse(state.slice(SPEC_BLOCK_PREFIX.length));
  } catch {
    return null;
  }
}
