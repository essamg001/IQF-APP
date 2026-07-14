import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

export default async function StoragePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; coldRoomId?: string }>;
}) {
  const { status, coldRoomId } = await searchParams;

  const [pallets, coldRooms, counts] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: (status as never) || undefined,
        coldRoomId: coldRoomId || undefined,
      },
      include: { lot: { include: { field: true, factory: true } }, coldRoom: true, client: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
    prisma.pallet.groupBy({ by: ["status"], _count: true }),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Storage</h1>
        <p className="mt-1 text-sm text-slate-500">Pallet-level view of what&apos;s in cold storage — sold vs. unsold, by room.</p>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-3">
        {(["IN_STORAGE", "ALLOCATED", "SHIPPED", "DISCOUNT_OFFERED", "WASTE"] as const).map((s) => (
          <Card key={s} className="p-3 text-center">
            <p className="text-xs text-slate-500">{s.replace("_", " ")}</p>
            <p className="text-lg font-semibold text-slate-900">{countMap[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      <form className="mt-4 flex gap-3" method="get">
        <select name="status" defaultValue={status ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="IN_STORAGE">In Storage (unsold)</option>
          <option value="ALLOCATED">Allocated (sold)</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DISCOUNT_OFFERED">Discount Offered</option>
          <option value="WASTE">Waste</option>
        </select>
        <select name="coldRoomId" defaultValue={coldRoomId ?? ""} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All cold rooms</option>
          {coldRooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="rounded-md bg-emerald-700 px-3.5 py-2 text-sm font-medium text-white">Filter</button>
      </form>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Pallet #</th>
              <th className="px-4 py-2 font-medium">Lot</th>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Factory</th>
              <th className="px-4 py-2 font-medium">Cold Room</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Client</th>
            </tr>
          </thead>
          <tbody>
            {pallets.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/storage/${p.id}`} className="font-medium text-emerald-700 hover:underline">
                    {p.palletNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.lot.lotNumber}</td>
                <td className="px-4 py-2">{p.lot.field.name}</td>
                <td className="px-4 py-2">{p.lot.factory.name}</td>
                <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLOR[p.status]}>{p.status.replace("_", " ")}</Badge>
                </td>
                <td className="px-4 py-2">{p.client?.name ?? "—"}</td>
              </tr>
            ))}
            {pallets.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No pallets match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
