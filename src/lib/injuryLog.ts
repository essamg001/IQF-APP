// Blue plaster / glove "current balance" is derived, not stored -- the
// month's opening balance minus the running total of itemsReleased across
// rows in chronological order. A typed balance can drift from reality; a
// computed one can't.
export function runningBalances(opening: number | null, releases: (number | null)[]): (number | null)[] {
  if (opening == null) return releases.map(() => null);
  let remaining = opening;
  return releases.map((r) => {
    remaining -= r ?? 0;
    return remaining;
  });
}
