import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getPalletQualitySnapshots } from "@/lib/palletQuality";
import { buildRackOrder, nextAvailableSlot, suggestReshelfSlot } from "@/lib/coldStorage";
import { ColdRoomGrid } from "./cold-room-grid";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function ColdRoomMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ coldRoomId: string }>;
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { coldRoomId } = await params;
  const { highlight } = await searchParams;
  const highlightPalletIds = highlight ? highlight.split(",").filter(Boolean) : undefined;
  const dict = getDictionary(await resolveLocale()).storage;

  const coldRoom = await prisma.coldRoom.findUnique({ where: { id: coldRoomId } });
  if (!coldRoom) notFound();

  const [slots, unassignedPallets, pullAsides] = await Promise.all([
    prisma.coldRoomSlot.findMany({
      where: { coldRoomId },
      include: {
        pallet: {
          include: { lot: { include: { fields: { include: { field: true } } } }, client: true },
        },
      },
      orderBy: [{ round: "asc" }, { rack: "asc" }, { level: "asc" }],
    }),
    prisma.pallet.findMany({
      // Any slot-less pallet is assignable here, regardless of which cold
      // room its own Final Product Entry packing record happened to guess --
      // that guess is an unfiltered, non-authoritative pick made at packing
      // time (see packing-form.tsx), and deciding the real room is the whole
      // point of this screen. An earlier version scoped this to pallets
      // nominally packed for THIS room, which meant a room nobody happened
      // to guess at packing time showed an empty dropdown forever even with
      // plenty of free slots -- not a per-room quirk, any room could hit it.
      where: {
        slot: null,
        status: { notIn: ["SHIPPED", "WASTE"] },
      },
      include: { lot: { include: { fields: { include: { field: true } } } } },
      // Oldest not-yet-shelved pallet first -- matches the physical routine
      // of shelving pallets roughly in the order they come off the line.
      orderBy: { createdAt: "asc" },
      take: 300,
    }),
    prisma.palletPullAside.findMany({
      where: { coldRoomId, resolvedAt: null },
      include: { pallet: true },
      orderBy: { pulledAt: "asc" },
    }),
  ]);

  const occupiedPallets = slots.filter((s) => s.pallet).map((s) => s.pallet!);
  const qualityByPalletId = await getPalletQualitySnapshots(occupiedPallets.map((p) => ({ id: p.id, lotId: p.lotId })));

  const rackOrder = buildRackOrder(coldRoom.rackCount);
  const slotPositions = slots.map((s) => ({ id: s.id, round: s.round, rack: s.rack, level: s.level, palletId: s.palletId }));
  const suggestedSlot = nextAvailableSlot(slotPositions, rackOrder);

  // Each pull-aside's suggested way back: same line it came from, filled
  // from the back (see suggestReshelfSlot) -- computed fresh against the
  // slot state as it stands right now, not cached, since another
  // pull-aside/reshelve happening in the same room changes what's empty.
  const pullAsidesForClient = pullAsides.map((p) => {
    const suggested = suggestReshelfSlot(slotPositions, p.round, p.rack);
    return {
      id: p.id,
      palletId: p.palletId,
      palletNumber: p.pallet.palletNumber,
      round: p.round,
      rack: p.rack,
      pulledAt: p.pulledAt.toISOString(),
      reason: p.reason,
      isTestData: p.pallet.isTestData,
      suggestedSlot: suggested ? { id: suggested.id, round: suggested.round, rack: suggested.rack, level: suggested.level } : null,
    };
  });

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
          fieldNames: s.pallet.lot.fields.map((f) => f.field.name).join(", "),
          clientName: s.pallet.client?.name ?? null,
          quality: qualityByPalletId.get(s.pallet.id) ?? null,
          isTestData: s.pallet.isTestData || s.pallet.lot.isTestData,
        }
      : null,
  }));

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {coldRoom.name}
          {dict.coldRoomMapTitleSuffix}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {dict.coldRoomMapSubtitle
            .replace("{rounds}", String(coldRoom.rounds))
            .replace("{roundsPlural}", coldRoom.rounds === 1 ? "" : "s")
            .replace("{racks}", String(coldRoom.rackCount))
            .replace("{levels}", String(coldRoom.levelCount))}
        </p>
      </div>

      <ColdRoomGrid
        coldRoomId={coldRoom.id}
        rounds={coldRoom.rounds}
        rackCount={coldRoom.rackCount}
        levelCount={coldRoom.levelCount}
        slots={slotsForClient}
        suggestedSlotId={suggestedSlot?.id ?? null}
        highlightPalletIds={highlightPalletIds}
        pullAsides={pullAsidesForClient}
        unassignedPallets={unassignedPallets.map((p) => ({
          id: p.id,
          palletNumber: p.palletNumber,
          lotNumber: p.lot.lotNumber,
          fieldNames: p.lot.fields.map((f) => f.field.name).join(", "),
          isTestData: p.isTestData || p.lot.isTestData,
        }))}
      />
    </div>
  );
}
