import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PreDecapForm } from "./pre-decap-form";

export default async function PreDecapInspectionPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [todaysChecks, fields, harvestTickets] = await Promise.all([
    prisma.qualityCheck.findMany({
      where: { checkpoint: "PRE_DECAP", createdAt: { gte: startOfToday } },
      include: { field: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } }),
    prisma.harvestTicket.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      include: { plotLines: { include: { field: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const accepted = todaysChecks.filter((c) => c.decision === "ACCEPTED").length;
  const rejected = todaysChecks.filter((c) => c.decision === "REJECTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Decap: Pre-Decap Arrivals</h1>
        <p className="mt-1 text-sm text-slate-500">
          Packhouse intake quality assessment (STR03101) — fruit arriving at the decap facility from the field,
          before decapping. Recording the plot number here ties each day&apos;s frozen output back to the exact
          fields it came from.
        </p>
      </div>

      <div className="flex gap-4">
        <Badge color="slate">{todaysChecks.length} logged today</Badge>
        <Badge color="green">{accepted} accepted</Badge>
        <Badge color="red">{rejected} rejected</Badge>
      </div>

      <div className="max-w-3xl">
        <PreDecapForm fields={fields} harvestTickets={harvestTickets} />
      </div>

      <Card className="max-w-3xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Today&apos;s Log</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Sample</th>
              <th className="px-4 py-2 font-medium">Plot</th>
              <th className="px-4 py-2 font-medium">Receipt Note</th>
              <th className="px-4 py-2 font-medium">Total Defects</th>
              <th className="px-4 py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {todaysChecks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-500">
                  {c.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/quality-check/${c.id}`} className="text-emerald-700 hover:underline">
                    {c.sampleNo ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.field?.name ?? "—"}</td>
                <td className="px-4 py-2">{c.receiptNoteNo ?? "—"}</td>
                <td className="px-4 py-2">
                  {c.totalDefectsPct != null ? (
                    <Badge color={c.totalDefectsPct > 60 ? "red" : "green"}>{c.totalDefectsPct.toFixed(1)}%</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge color={c.decision === "ACCEPTED" ? "green" : "red"}>{c.decision}</Badge>
                </td>
              </tr>
            ))}
            {todaysChecks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  Nothing logged yet today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
