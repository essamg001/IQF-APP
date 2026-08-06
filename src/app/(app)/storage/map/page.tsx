import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const FORMAT_LABEL: Record<string, string> = { WHOLE: "Whole", SLICED: "Sliced", DICED: "Diced" };

export default async function StorageMapPage() {
  const [coldRooms, occupiedSlots] = await Promise.all([
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.coldRoomSlot.findMany({
      where: { palletId: { not: null } },
      select: { coldRoomId: true, pallet: { select: { lot: { select: { grade: true, format: true } } } } },
    }),
  ]);

  // Grouped once here rather than a separate query per room -- also feeds
  // the "what's already in this room" composition badge below, so a user
  // browsing rooms can tell at a glance whether a pallet's grade/format is
  // already concentrated somewhere before opening the grid.
  const palletTypesByRoom = new Map<string, { grade: string; format: string }[]>();
  for (const s of occupiedSlots) {
    if (!s.pallet) continue;
    const list = palletTypesByRoom.get(s.coldRoomId) ?? [];
    list.push({ grade: s.pallet.lot.grade, format: s.pallet.lot.format });
    palletTypesByRoom.set(s.coldRoomId, list);
  }

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Storage Map</h1>
        <p className="mt-1 text-sm text-slate-500">
          Exact rack/level position of every pallet, matching the physical storage layout.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {coldRooms.map((c) => {
          const pallets = palletTypesByRoom.get(c.id) ?? [];
          const occupied = pallets.length;
          const capacity = c.capacityPallets;
          const pct = capacity ? Math.round((occupied / capacity) * 100) : 0;
          const distinctTypes = new Set(pallets.map((p) => `${p.grade}::${p.format}`));
          const composition =
            occupied === 0
              ? "Empty"
              : distinctTypes.size === 1
                ? `Grade ${pallets[0].grade} · ${FORMAT_LABEL[pallets[0].format] ?? pallets[0].format}`
                : "Mixed";
          return (
            <Link key={c.id} href={`/storage/map/${c.id}`}>
              <Card className="transition hover:border-emerald-300 hover:shadow">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{c.name}</h2>
                  <Badge color={pct > 90 ? "red" : pct > 60 ? "amber" : "green"}>{pct}% full</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {occupied} / {capacity} pallets
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.rounds} round{c.rounds === 1 ? "" : "s"} × {c.rackCount} racks × {c.levelCount} levels
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{composition}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
