import { prisma } from "@/lib/prisma";
import { ContainerForm } from "./container-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function NewContainerPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const dict = getDictionary(await resolveLocale()).logistics;
  const orders = await prisma.order.findMany({
    // A cancelled order's pallets were already released back to stock --
    // it shouldn't still be pickable here even though its stage itself
    // (usually still CONFIRMED) wouldn't otherwise exclude it.
    where: { stage: { notIn: ["DELIVERED", "PAID"] }, cancelledAt: null },
    include: {
      client: true,
      pallets: { select: { id: true, coldRoomId: true, weightTonnes: true, loadLines: { select: { quantityTonnes: true } }, coldRoom: { select: { name: true } } } },
    },
    orderBy: { orderDate: "desc" },
  });

  // Same "which room holds the most of this order's still-unloaded pallets"
  // logic createContainerAction uses for its post-creation redirect --
  // computed here too so the create-container form can show it the moment
  // an order is picked, before the container even exists. Catches a wrong
  // order pick immediately (the location shown won't match what the
  // person expects) rather than only after committing to create it.
  const roomSummaryByOrder: Record<
    string,
    { roomId: string; roomName: string; readyCount: number; target: number; palletIds: string[] } | null
  > = {};
  for (const o of orders) {
    const pending = o.pallets.filter(
      (p) => p.coldRoomId && p.weightTonnes - p.loadLines.reduce((s, l) => s + l.quantityTonnes, 0) > 0.01
    );
    const byRoom = new Map<string, { name: string; palletIds: string[] }>();
    for (const p of pending) {
      const entry = byRoom.get(p.coldRoomId!) ?? { name: p.coldRoom!.name, palletIds: [] };
      entry.palletIds.push(p.id);
      byRoom.set(p.coldRoomId!, entry);
    }
    const top = [...byRoom.entries()].sort((a, b) => b[1].palletIds.length - a[1].palletIds.length)[0];
    roomSummaryByOrder[o.id] = top
      ? { roomId: top[0], roomName: top[1].name, readyCount: top[1].palletIds.length, target: o.quantityPallets, palletIds: top[1].palletIds }
      : null;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">{dict.createContainerTitle}</h1>
      <div className="mt-6 max-w-xl">
        <ContainerForm orders={orders} defaultOrderId={orderId} roomSummaryByOrder={roomSummaryByOrder} />
      </div>
    </div>
  );
}
