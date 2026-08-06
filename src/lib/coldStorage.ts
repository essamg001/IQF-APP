import { prisma } from "@/lib/prisma";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function rackLetter(index: number) {
  // index is 0-based; supports beyond 26 racks (AA, AB, ...) just in case.
  let n = index;
  let s = "";
  do {
    s = ALPHABET[n % 26] + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export async function generateSlotsForColdRoom(
  coldRoomId: string,
  rounds: number,
  rackCount: number,
  levelCount: number
) {
  const rows: { coldRoomId: string; round: number; rack: string; level: number }[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (let r = 0; r < rackCount; r++) {
      const rack = rackLetter(r);
      for (let level = 1; level <= levelCount; level++) {
        rows.push({ coldRoomId, round, rack, level });
      }
    }
  }
  await prisma.coldRoomSlot.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}

export function buildRackOrder(rackCount: number): string[] {
  return Array.from({ length: rackCount }, (_, i) => rackLetter(i));
}

type SlotPosition = { id: string; round: number; rack: string; level: number; palletId: string | null };

// Matches the physical fill routine: ground level filled left-to-right across
// every rack before moving up a level, and a whole round (floor) filled
// before moving to the next -- a fixed scan order, not a scored/weighted
// recommendation, so the result is always predictable and auditable.
export function nextAvailableSlot(slots: SlotPosition[], rackOrder: string[]): SlotPosition | null {
  const rackIndex = new Map(rackOrder.map((r, i) => [r, i]));
  const empty = slots.filter((s) => !s.palletId);
  empty.sort(
    (a, b) => a.round - b.round || a.level - b.level || (rackIndex.get(a.rack) ?? 0) - (rackIndex.get(b.rack) ?? 0)
  );
  return empty[0] ?? null;
}

export type ProductType = { grade: string; format: string };

/** The most common (grade, format) pair among a room's occupied pallets -- null if the room is empty. */
export function dominantProductType(pallets: ProductType[]): ProductType | null {
  if (pallets.length === 0) return null;
  const counts = new Map<string, { type: ProductType; count: number }>();
  for (const p of pallets) {
    const key = `${p.grade}::${p.format}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { type: p, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0].type;
}

// Prefers a room already dominated by the same grade+format (keeps
// interchangeable stock together for easier allocation/audits) over a rigid
// per-room designation, which would waste capacity whenever the production
// mix shifts. Falls back to any room with space; among tied candidates,
// prefers the fuller one so spare capacity stays concentrated in fewer rooms.
export function suggestColdRoom(
  rooms: { id: string; capacityPallets: number; occupiedCount: number; pallets: ProductType[] }[],
  pallet: ProductType
): string | null {
  const withSpace = rooms.filter((r) => r.occupiedCount < r.capacityPallets);
  if (withSpace.length === 0) return null;
  const matching = withSpace.filter((r) => {
    const dominant = dominantProductType(r.pallets);
    return dominant && dominant.grade === pallet.grade && dominant.format === pallet.format;
  });
  const pool = matching.length > 0 ? matching : withSpace;
  return pool.sort((a, b) => b.occupiedCount / b.capacityPallets - a.occupiedCount / a.capacityPallets)[0].id;
}
