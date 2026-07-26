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
