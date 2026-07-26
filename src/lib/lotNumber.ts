/**
 * Real lot number format, e.g. M41126146-1:
 *   M4     farm code
 *   11     IQF unit code (Factory.code -- IQF 1 = "11", IQF 2 = "13")
 *   26     2-digit year
 *   146    3-digit day of year (146 = 26 May)
 *   -1     shift digit (1 = day, 2 = night)
 */
export function generateLotNumber(params: {
  farmCode: string;
  factoryCode: string;
  date: Date;
  shiftType: "DAY" | "NIGHT";
}): string {
  const { farmCode, factoryCode, date, shiftType } = params;
  const year = String(date.getFullYear()).slice(-2);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1;
  const dayOfYearPadded = String(dayOfYear).padStart(3, "0");
  const shiftDigit = shiftType === "DAY" ? "1" : "2";
  return `${farmCode}${factoryCode}${year}${dayOfYearPadded}-${shiftDigit}`;
}
