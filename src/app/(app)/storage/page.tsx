import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import Link from "next/link";
import { getPalletQualitySnapshots } from "@/lib/palletQuality";
import { CfuTierBadge } from "@/components/cfu-tier-badge";
import { CfuTierLegend } from "@/components/cfu-tier-legend";
import { MrlStatusBadge } from "@/components/mrl-status-badge";
import { TEST_DATA_TEXT_CLASS } from "@/components/test-data-badge";
import { cn } from "@/lib/cn";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

const STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

function statusLabel(dict: Dictionary["storage"], status: keyof typeof STATUS_COLOR) {
  return {
    IN_STORAGE: dict.statusInStorage,
    ALLOCATED: dict.statusAllocated,
    SHIPPED: dict.statusShipped,
    WASTE: dict.statusWaste,
    DISCOUNT_OFFERED: dict.statusDiscountOffered,
  }[status];
}

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; coldRoomId?: string }>;
}) {
  const { status, coldRoomId } = await searchParams;
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.storage;

  const [pallets, coldRooms, counts] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: (status as never) || undefined,
        coldRoomId: coldRoomId || undefined,
      },
      include: {
        lot: { include: { fields: { include: { field: true } }, factory: true } },
        coldRoom: true,
        client: true,
        slot: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.pallet.groupBy({ by: ["status"], _count: true }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const qualityByPalletId = await getPalletQualitySnapshots(pallets.map((p) => ({ id: p.id, lotId: p.lotId })));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <LinkButton href="/storage/map" variant="secondary">
          {dict.storageMapLink}
        </LinkButton>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {(["IN_STORAGE", "ALLOCATED", "SHIPPED", "DISCOUNT_OFFERED", "WASTE"] as const).map((s) => (
          <Card key={s} className="p-3 text-center">
            <p className="text-xs text-slate-500">{statusLabel(dict, s)}</p>
            <p className="text-lg font-semibold text-slate-900">{countMap[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      <form className="mt-4 flex gap-3" method="get">
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">{dict.allStatuses}</option>
          <option value="IN_STORAGE">{dict.statusInStorageOption}</option>
          <option value="ALLOCATED">{dict.statusAllocatedOption}</option>
          <option value="SHIPPED">{dict.statusShipped}</option>
          <option value="DISCOUNT_OFFERED">{dict.statusDiscountOffered}</option>
          <option value="WASTE">{dict.statusWaste}</option>
        </select>
        <select name="coldRoomId" defaultValue={coldRoomId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">{dict.allColdRooms}</option>
          {coldRooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white">{dict.filterButton}</button>
      </form>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colPalletNumber}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colField}</th>
              <th className="px-4 py-2 font-medium">{dict.colFactory}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colLocation}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.colTotalPlateCount}</th>
              <th className="px-4 py-2 font-medium">{dict.colMrl}</th>
            </tr>
          </thead>
          <tbody>
            {pallets.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/storage/${p.id}`}
                    className={cn("font-medium text-emerald-700 hover:underline", p.isTestData && TEST_DATA_TEXT_CLASS)}
                  >
                    {p.palletNumber}
                  </Link>
                </td>
                <td className={cn("px-4 py-2", p.lot.isTestData && TEST_DATA_TEXT_CLASS)}>{p.lot.lotNumber}</td>
                <td className="px-4 py-2">{p.lot.fields.map((f) => f.field.name).join(", ")}</td>
                <td className="px-4 py-2">{p.lot.factory.name}</td>
                <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  {p.slot
                    ? dict.rackLevelRound
                        .replace("{rack}", p.slot.rack)
                        .replace("{level}", String(p.slot.level))
                        .replace("{round}", String(p.slot.round))
                    : "—"}
                </td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLOR[p.status]}>{statusLabel(dict, p.status)}</Badge>
                </td>
                <td className="px-4 py-2">{p.client?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <CfuTierBadge cfuValue={qualityByPalletId.get(p.id)?.cfuValue ?? null} />
                </td>
                <td className="px-4 py-2">
                  <MrlStatusBadge status={qualityByPalletId.get(p.id)?.mrlStatus ?? "PENDING"} />
                </td>
              </tr>
            ))}
            {pallets.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {dict.noPalletsMatch}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <CfuTierLegend
        className="mt-3"
        title={fullDict.common.cfuLegendTitle}
        rejectWord={fullDict.common.cfuRejectWord}
      />
    </div>
  );
}
