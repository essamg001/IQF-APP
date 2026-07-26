import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackingForm } from "./packing-form";

export default async function FinalProductEntryPage() {
  const session = await auth();
  if (!session?.user || !["PRODUCTION", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const [lots, coldRooms] = await Promise.all([
    prisma.productionLot.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { field: true } }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Post-freeze inspection's size/caliber data auto-fills onto a pallet here
  // once its number is entered (exact pallet match preferred, else the lot's
  // latest lot-level check) -- see packing-form.tsx.
  const postFreezeChecks = await prisma.qualityCheck.findMany({
    where: { checkpoint: "POST_PACKAGING", lotId: { in: lots.map((l) => l.id) } },
    orderBy: { createdAt: "desc" },
    include: { pallet: true },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysPallets = await prisma.pallet.findMany({
    where: { createdAt: { gte: startOfToday } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { lot: true, coldRoom: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Final Product Entry</h1>
        <p className="mt-1 text-sm text-slate-500">
          Identification of Packed Pallets (GEN03115) — record every pallet as it&apos;s wrapped and sent to storage.
        </p>
      </div>

      <Badge color="slate">{todaysPallets.length} pallets recorded today</Badge>

      <div className="max-w-4xl">
        <PackingForm lots={lots} coldRooms={coldRooms} postFreezeChecks={postFreezeChecks} />
      </div>

      <Card className="max-w-4xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Today&apos;s Log</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Pallet #</th>
              <th className="px-4 py-2 font-medium">Lot</th>
              <th className="px-4 py-2 font-medium">Cold Room</th>
              <th className="px-4 py-2 font-medium">Cartons</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {todaysPallets.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-500">
                  {p.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">{p.palletNumber}</td>
                <td className="px-4 py-2">{p.lot.lotNumber}</td>
                <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                <td className="px-4 py-2">{p.totalCartons ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge color={p.fullPallet ? "green" : "amber"}>{p.fullPallet ? "Full" : "Partial"}</Badge>
                </td>
              </tr>
            ))}
            {todaysPallets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nothing recorded yet today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
