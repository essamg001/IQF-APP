import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PackingForm } from "./packing-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function FinalProductEntryPage() {
  const session = await auth();
  if (!session?.user || !["PRODUCTION", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const dict = getDictionary(await resolveLocale()).finalProductEntry;

  const [lots, coldRooms] = await Promise.all([
    prisma.productionLot.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { fields: { include: { field: true } } },
    }),
    prisma.coldRoom.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Post-Freeze Inspection's variety, client, full/partial call, and fruit
  // diameter grading all auto-fill onto a pallet here once its number is
  // entered (exact pallet match preferred, else the lot's latest lot-level
  // check, for older data logged before a pallet was required) -- see
  // packing-form.tsx.
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <Badge color="slate">
        {todaysPallets.length} {dict.palletsRecordedTodaySuffix}
      </Badge>

      <div className="no-print max-w-4xl">
        <PackingForm lots={lots} coldRooms={coldRooms} postFreezeChecks={postFreezeChecks} />
      </div>

      <Card className="max-w-4xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">{dict.todaysLogTitle}</h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colTime}</th>
              <th className="px-4 py-2 font-medium">{dict.colPalletNo}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colColdRoom}</th>
              <th className="px-4 py-2 font-medium">{dict.colCartons}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody>
            {todaysPallets.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">
                  {p.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/storage/${p.id}`} className="text-emerald-700 hover:underline">
                    {p.palletNumber}
                  </Link>
                </td>
                <td className="px-4 py-2">{p.lot.lotNumber}</td>
                <td className="px-4 py-2">{p.coldRoom?.name ?? "—"}</td>
                <td className="px-4 py-2">{p.totalCartons ?? "—"}</td>
                <td className="px-4 py-2">
                  <Badge color={p.fullPallet ? "green" : "amber"}>{p.fullPallet ? dict.full : dict.partial}</Badge>
                </td>
              </tr>
            ))}
            {todaysPallets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {dict.nothingRecordedToday}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
