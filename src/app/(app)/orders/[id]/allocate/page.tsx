import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { suggestAllocation } from "@/lib/allocation";
import { allocatePalletsAction } from "../../actions";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { TestDataBadge, TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function AllocateReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.orders;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { _count: { select: { pallets: true } } },
  });
  if (!order) notFound();

  const remaining = order.quantityPallets - order._count.pallets;
  if (remaining <= 0) redirect(`/orders/${id}`);

  // Read-only preview using the exact same picker the real allocation
  // commits with -- nothing is reserved here, so the confirm step below
  // re-runs this fresh inside its own transaction rather than trusting
  // these specific IDs, same as it always has. In the rare case another
  // allocation touches the same stock in between, what actually gets
  // committed may differ slightly from this preview; it's still no more
  // exposed to that than the old blind confirm was, just visible now.
  const picks = await suggestAllocation({
    clientId: order.clientId,
    grade: order.grade,
    format: order.format,
    quantity: remaining,
  });

  const coldRoomIds = [...new Set(picks.map((p) => p.slot?.coldRoomId).filter((v): v is string => !!v))];
  const coldRooms = coldRoomIds.length ? await prisma.coldRoom.findMany({ where: { id: { in: coldRoomIds } } }) : [];
  const coldRoomNameById = new Map(coldRooms.map((c) => [c.id, c.name]));

  const totalTonnes = picks.reduce((s, p) => s + p.weightTonnes, 0);

  const byRoom = new Map<string, { name: string; palletIds: string[] }>();
  for (const p of picks) {
    if (!p.slot) continue;
    const name = coldRoomNameById.get(p.slot.coldRoomId) ?? "—";
    const entry = byRoom.get(p.slot.coldRoomId) ?? { name, palletIds: [] };
    entry.palletIds.push(p.id);
    byRoom.set(p.slot.coldRoomId, entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.reviewAllocationTitle.replace("{orderNumber}", order.orderNumber)}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {dict.reviewAllocationSubtitle
            .replace("{count}", String(picks.length))
            .replace("{needed}", String(remaining))
            .replace("{tonnes}", totalTonnes.toFixed(1))}
        </p>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colLocation}</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <a
                    href={`/storage/${p.id}`}
                    className={cn("text-emerald-700 hover:underline", p.isTestData && TEST_DATA_TEXT_CLASS)}
                  >
                    {p.palletNumber}
                  </a>
                  {(p.isTestData || p.lot.isTestData) && (
                    <>
                      {" "}
                      <TestDataBadge />
                    </>
                  )}
                </td>
                <td className={cn("px-4 py-2", p.lot.isTestData && TEST_DATA_TEXT_CLASS)}>{p.lot.lotNumber}</td>
                <td className="px-4 py-2">{p.slot ? (coldRoomNameById.get(p.slot.coldRoomId) ?? "—") : "—"}</td>
                <td className="px-4 py-2">
                  {p.slot
                    ? fullDict.storage.rackLevelRound
                        .replace("{rack}", p.slot.rack)
                        .replace("{level}", String(p.slot.level))
                        .replace("{round}", String(p.slot.round))
                    : "—"}
                </td>
              </tr>
            ))}
            {picks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                  {dict.noEligiblePalletsToReview}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        {[...byRoom.entries()].map(([roomId, { name, palletIds }]) => (
          <LinkButton
            key={roomId}
            href={`/storage/map/${roomId}?highlight=${palletIds.join(",")}&orderId=${order.id}&returnTo=${encodeURIComponent(`/orders/${order.id}`)}`}
            variant="secondary"
          >
            {dict.viewOnStorageMap.replace("{room}", name)}
          </LinkButton>
        ))}
        <LinkButton href={`/orders/${id}`} variant="secondary">
          {dict.backToOrder}
        </LinkButton>
        {picks.length > 0 && (
          <form action={allocatePalletsAction.bind(null, id)}>
            <ConfirmSubmitButton
              confirmMessage={dict.confirmAllocationMessage
                .replace("{count}", String(picks.length))
                .replace("{tonnes}", totalTonnes.toFixed(1))
                .replace("{orderNumber}", order.orderNumber)}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
            >
              {dict.confirmAllocation}
            </ConfirmSubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
