// Training-expiry status, computed at read time -- no cron/alerts-engine
// hook yet (deliberately out of scope for the skeleton; a natural next step
// once real training data exists).
export type TrainingExpiryStatus = "NONE" | "OK" | "EXPIRING_SOON" | "EXPIRED";

export const TRAINING_EXPIRING_SOON_DAYS = 30;

export function trainingExpiryStatus(expiryDate: Date | null, now: Date): TrainingExpiryStatus {
  if (!expiryDate) return "NONE";
  const daysLeft = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= TRAINING_EXPIRING_SOON_DAYS) return "EXPIRING_SOON";
  return "OK";
}

export function trainingExpiryColor(status: TrainingExpiryStatus): "slate" | "green" | "amber" | "red" {
  if (status === "EXPIRED") return "red";
  if (status === "EXPIRING_SOON") return "amber";
  if (status === "OK") return "green";
  return "slate";
}

export function departmentCoveragePct(trainedCount: number, totalCount: number): number | null {
  if (totalCount <= 0) return null;
  return (trainedCount / totalCount) * 100;
}
