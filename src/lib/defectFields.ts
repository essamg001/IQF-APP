// Single source of truth for which QualityCheck fields sum into each
// checkpoint's aggregate "total defects" figure -- both the server action
// that computes totalDefectsPct and the client form's live running-total
// display (see src/lib/useDefectTotal.ts) import these, so the two can never
// drift apart the way two independently-maintained copies eventually would.

export const PRE_DECAP_DEFECT_FIELDS = [
  "overmaturePct",
  "diameterUnder22mmPct",
  "botrytisPct",
  "pestDiseasePct",
  "wormEatenPct",
  "bruisesPct",
  "shapeDeformitiesPct",
  "sandDustPct",
  "foreignBodiesPct",
] as const;

// Shared by RAW_MATERIAL (Arrival Inspection) and POST_DECAP (Post-Decap
// Quality) -- same defect checklist, same fields (mirrors DECAP_SHARED_LIMITS
// in src/lib/qualityLimits.ts).
export const DECAP_SHARED_DEFECT_FIELDS = [
  "incompleteMaturityPct",
  "moldSignsPct",
  "mouldPct",
  "capsuleRemainsPct",
  "birdFoodPct",
  "overmaturePct",
  "skinDamagePct",
  "shapeDeformitiesPct",
  "seedClusteringPct",
  "bruisesPct",
  "dryCavitiesPct",
  "overDecappingPct",
  "oxidationPct",
  "sandDustPct",
  "insectsLarvaePct",
  "foreignBodiesPct",
  "brokenUncleanPalletsPct",
  "unfumigatedPalletsPct",
  "brokenUncleanCratesPct",
] as const;

export const POST_PACKAGING_DEFECT_FIELDS = [
  "overmaturePct",
  "incompleteMaturityPct",
  "shapeDeformitiesPct",
  "skinDamagePct",
  "cohesiveClustersPct",
  "crushedBrokenFruitPct",
  "dryBruisesPct",
  "mechanicalFactorsPct",
  "oxidationPct",
  "fungalInfectionPct",
  "insectsLarvaePct",
  "insectInfestationPct",
  "foreignBodiesPct",
] as const;
