import { prisma } from "@/lib/prisma";
import type { Grade } from "@prisma/client";
import { combinedMicroStatus, type CombinedMicroStatus } from "@/lib/microbiology";
import { combinedCfuValue } from "@/lib/cfuTier";

export type PalletQualitySnapshot = {
  grade: Grade;
  microbiologyStatus: CombinedMicroStatus;
  /** Higher (worse) of the two labs' Total Plate Count readings, in cfu/g -- null if neither has reported one yet. */
  cfuValue: number | null;
  brix: number | null;
  mouldPct: number | null;
  internalQualityPct: number | null;
  // "pallet": a check was logged against this exact pallet.
  // "lot": no pallet-specific check, falling back to the most recent
  // post-packaging check for the lot it came from.
  // "none": no post-packaging check logged for either yet.
  source: "pallet" | "lot" | "none";
};

/** Single-pallet lookup — fine for a detail page, avoid in a loop over many pallets. */
export async function getPalletQualitySnapshot(pallet: { id: string; lotId: string }): Promise<PalletQualitySnapshot> {
  const map = await getPalletQualitySnapshots([pallet]);
  return map.get(pallet.id)!;
}

/** Batch version for grid/list views — one query per data source regardless of pallet count. */
export async function getPalletQualitySnapshots(
  pallets: { id: string; lotId: string }[]
): Promise<Map<string, PalletQualitySnapshot>> {
  const lotIds = [...new Set(pallets.map((p) => p.lotId))];

  const [lots, palletChecks, lotChecks] = await Promise.all([
    prisma.productionLot.findMany({
      where: { id: { in: lotIds } },
      include: { microbiologyResults: true, shift: true },
    }),
    prisma.qualityCheck.findMany({
      where: { palletId: { in: pallets.map((p) => p.id) }, checkpoint: "POST_PACKAGING" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.qualityCheck.findMany({
      where: { lotId: { in: lotIds }, checkpoint: "POST_PACKAGING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lotById = new Map(lots.map((l) => [l.id, l]));
  const latestPalletCheck = new Map<string, (typeof palletChecks)[number]>();
  for (const c of palletChecks) {
    if (c.palletId && !latestPalletCheck.has(c.palletId)) latestPalletCheck.set(c.palletId, c);
  }
  const latestLotCheck = new Map<string, (typeof lotChecks)[number]>();
  for (const c of lotChecks) {
    if (c.lotId && !latestLotCheck.has(c.lotId)) latestLotCheck.set(c.lotId, c);
  }

  const result = new Map<string, PalletQualitySnapshot>();
  for (const p of pallets) {
    const lot = lotById.get(p.lotId);
    const grade = lot?.grade ?? "A";
    const microbiologyStatus = lot ? combinedMicroStatus(lot.microbiologyResults, lot.shift.onHold) : "PENDING";
    const cfuValue = lot ? combinedCfuValue(lot.microbiologyResults) : null;

    const palletCheck = latestPalletCheck.get(p.id);
    if (palletCheck) {
      result.set(p.id, {
        grade,
        microbiologyStatus,
        cfuValue,
        brix: palletCheck.brix,
        mouldPct: palletCheck.mouldPct,
        internalQualityPct: palletCheck.internalQualityPct,
        source: "pallet",
      });
      continue;
    }

    const lotCheck = latestLotCheck.get(p.lotId);
    if (lotCheck) {
      result.set(p.id, {
        grade,
        microbiologyStatus,
        cfuValue,
        brix: lotCheck.brix,
        mouldPct: lotCheck.mouldPct,
        internalQualityPct: lotCheck.internalQualityPct,
        source: "lot",
      });
      continue;
    }

    result.set(p.id, { grade, microbiologyStatus, cfuValue, brix: null, mouldPct: null, internalQualityPct: null, source: "none" });
  }

  return result;
}
