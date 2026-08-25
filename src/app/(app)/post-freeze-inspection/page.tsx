import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PostFreezeInspectionForm } from "./post-freeze-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function PostFreezeInspectionPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const dict = getDictionary(await resolveLocale()).postFreezeInspection;

  const lots = await prisma.productionLot.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { fields: { include: { field: true } }, pallets: true, shift: true },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysChecks = await prisma.qualityCheck.findMany({
    where: { checkpoint: "POST_PACKAGING", createdAt: { gte: startOfToday } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { lot: true, pallet: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <div className="max-w-3xl">
        <PostFreezeInspectionForm lots={lots} />
      </div>

      <Card className="max-w-3xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">
          {dict.todaysLogTitle.replace("{count}", String(todaysChecks.length))}
        </h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colTime}</th>
              <th className="px-4 py-2 font-medium">{dict.colLot}</th>
              <th className="px-4 py-2 font-medium">{dict.colPallet}</th>
              <th className="px-4 py-2 font-medium">{dict.colBrix}</th>
              <th className="px-4 py-2 font-medium">{dict.colTotalDefects}</th>
              <th className="px-4 py-2 font-medium">{dict.colDecision}</th>
            </tr>
          </thead>
          <tbody>
            {todaysChecks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">
                  {c.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">{c.lot?.lotNumber ?? "—"}</td>
                <td className="px-4 py-2">
                  <Link href={`/quality-check/${c.id}`} className="text-emerald-700 hover:underline">
                    {c.pallet?.palletNumber ?? dict.lotLevel}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.brix}</td>
                <td className="px-4 py-2">
                  {c.totalDefectsPct != null ? `${c.totalDefectsPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-4 py-2">
                  {c.decision ? (
                    <Badge color={c.decision === "ACCEPTED" ? "green" : "red"}>
                      {c.decision === "ACCEPTED" ? dict.acceptable : dict.unacceptable}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {todaysChecks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  {dict.nothingLoggedToday}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
