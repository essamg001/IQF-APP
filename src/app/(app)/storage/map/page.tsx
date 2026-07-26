import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function StorageMapPage() {
  const coldRooms = await prisma.coldRoom.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { slots: { where: { palletId: { not: null } } } } } },
  });
  const capacities = await prisma.coldRoom.findMany({ select: { id: true, capacityPallets: true } });
  const capacityById = new Map(capacities.map((c) => [c.id, c.capacityPallets]));

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
          const capacity = capacityById.get(c.id) ?? 0;
          const occupied = c._count.slots;
          const pct = capacity ? Math.round((occupied / capacity) * 100) : 0;
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
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
