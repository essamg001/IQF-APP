import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPalletQualitySnapshots } from "@/lib/palletQuality";
import { buildRackOrder, nextAvailableSlot } from "@/lib/coldStorage";
import { ColdRoomGrid } from "./cold-room-grid";

export default async function ColdRoomMapPage({ params }: { params: Promise<{ coldRoomId: string }> }) {
  const { coldRoomId } = await params;

  const coldRoom = await prisma.coldRoom.findUnique({ where: { id: coldRoomId } });
  if (!coldRoom) notFound();

  const [slots, unassignedPallets] = await Promise.all([
    prisma.coldRoomSlot.findMany({
      where: { coldRoomId },
      include: {
        pallet: {
          include: { lot: { include: { field: true } }, client: true },
        },
      },
      orderBy: [{ round: "asc" }, { rack: "asc" }, { level: "asc" }],
    }),
    prisma.pallet.findMany({
      where: { slot: null, status: { notIn: ["SHIPPED", "WASTE"] } },
      include: { lot: { include: { field: true } } },
      // Oldest not-yet-shelved pallet first -- matches the physical routine
      // of shelving pallets roughly in the order they come off the line.
      orderBy: { createdAt: "asc" },
      take: 300,
    }),
  ]);

  const occupiedPallets = slots.filter((s) => s.pallet).map((s) => s.pallet!);
  const qualityByPalletId = await getPalletQualitySnapshots(occupiedPallets.map((p) => ({ id: p.id, lotId: p.lotId })));

  const rackOrder = buildRackOrder(coldRoom.rackCount);
  const suggestedSlot = nextAvailableSlot(
    slots.map((s) => ({ id: s.id, round: s.round, rack: s.rack, level: s.level, palletId: s.palletId })),
    rackOrder
  );

  const slotsForClient = slots.map((s) => ({
    id: s.id,
    round: s.round,
    rack: s.rack,
    level: s.level,
    pallet: s.pallet
      ? {
          id: s.pallet.id,
          palletNumber: s.pallet.palletNumber,
          status: s.pallet.status,
          lotNumber: s.pallet.lot.lotNumber,
          fieldName: s.pallet.lot.field.name,
          clientName: s.pallet.client?.name ?? null,
          quality: qualityByPalletId.get(s.pallet.id) ?? null,
          isTestData: s.pallet.isTestData || s.pallet.lot.isTestData,
        }
      : null,
  }));

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{coldRoom.name} — Storage Map</h1>
        <p className="mt-1 text-sm text-slate-500">
          {coldRoom.rounds} round{coldRoom.rounds === 1 ? "" : "s"} × {coldRoom.rackCount} racks × {coldRoom.levelCount}{" "}
          levels · click a slot to assign, view, or unassign a pallet.
        </p>
      </div>

      <ColdRoomGrid
        coldRoomId={coldRoom.id}
        rounds={coldRoom.rounds}
        rackCount={coldRoom.rackCount}
        levelCount={coldRoom.levelCount}
        slots={slotsForClient}
        suggestedSlotId={suggestedSlot?.id ?? null}
        unassignedPallets={unassignedPallets.map((p) => ({
          id: p.id,
          palletNumber: p.palletNumber,
          lotNumber: p.lot.lotNumber,
          fieldName: p.lot.field.name,
          isTestData: p.isTestData || p.lot.isTestData,
        }))}
      />
    </div>
  );
}
