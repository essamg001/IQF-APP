// Small, pure costing calculations -- shared so the per-container margin
// card and the /costing rollup page compute the same numbers the same way.
// Data-fetching and aggregation across containers/clients stays in the page
// files themselves, matching the existing /trends pages' pattern.

type ShiftCostInput = {
  rawMaterialCostEgp: number | null;
  laborHourlyRateEgpSnapshot: number | null;
  workerCount: number;
  startTime: Date;
  endTime: Date;
};

export function shiftHoursWorked(shift: Pick<ShiftCostInput, "startTime" | "endTime">): number {
  return (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
}

/**
 * A shift's raw-material + labor cost, per tonne of output, in EGP --
 * allocated across every lot/pallet that shift produced rather than traced
 * pallet-by-pallet (ProductionLot has no link back to the specific harvest
 * ticket(s) that fed it). Returns null when neither cost has been entered
 * yet, so callers can distinguish "zero cost" from "not costed yet".
 */
export function shiftCostPerTonneEgp(
  shift: ShiftCostInput,
  totalTonnageThisShift: number
): number | null {
  if (shift.rawMaterialCostEgp == null && shift.laborHourlyRateEgpSnapshot == null) return null;
  if (totalTonnageThisShift <= 0) return null;

  const laborCostEgp =
    shift.laborHourlyRateEgpSnapshot != null
      ? shift.laborHourlyRateEgpSnapshot * shift.workerCount * shiftHoursWorked(shift)
      : 0;
  const rawMaterialCostEgp = shift.rawMaterialCostEgp ?? 0;

  return (rawMaterialCostEgp + laborCostEgp) / totalTonnageThisShift;
}

export function egpToUsd(amountEgp: number, fxRateEgpPerUsd: number | null): number | null {
  if (fxRateEgpPerUsd == null || fxRateEgpPerUsd <= 0) return null;
  return amountEgp / fxRateEgpPerUsd;
}

export type ContainerMargin = {
  revenueUsd: number | null;
  rawMaterialAndLaborEgp: number | null;
  rawMaterialAndLaborUsd: number | null;
  packagingCostUsd: number;
  logisticsCostUsd: number;
  claimsUsd: number;
  /** null whenever revenue or the EGP->USD conversion isn't available yet. */
  marginUsd: number | null;
};

export function computeContainerMargin(params: {
  revenueUsd: number | null;
  rawMaterialAndLaborEgp: number | null;
  fxRateEgpPerUsd: number | null;
  packagingCostUsd: number;
  logisticsCostUsd: number;
  claimsUsd: number;
}): ContainerMargin {
  const rawMaterialAndLaborUsd =
    params.rawMaterialAndLaborEgp != null ? egpToUsd(params.rawMaterialAndLaborEgp, params.fxRateEgpPerUsd) : null;

  const marginUsd =
    params.revenueUsd != null && rawMaterialAndLaborUsd != null
      ? params.revenueUsd -
        rawMaterialAndLaborUsd -
        params.packagingCostUsd -
        params.logisticsCostUsd -
        params.claimsUsd
      : null;

  return {
    revenueUsd: params.revenueUsd,
    rawMaterialAndLaborEgp: params.rawMaterialAndLaborEgp,
    rawMaterialAndLaborUsd,
    packagingCostUsd: params.packagingCostUsd,
    logisticsCostUsd: params.logisticsCostUsd,
    claimsUsd: params.claimsUsd,
    marginUsd,
  };
}
