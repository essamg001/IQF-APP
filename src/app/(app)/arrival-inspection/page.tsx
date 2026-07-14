import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrivalInspectionForm } from "./arrival-form";

export default async function ArrivalInspectionPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const todaysChecks = await prisma.qualityCheck.findMany({
    where: {
      checkpoint: "RAW_MATERIAL",
      lotId: null,
      createdAt: { gte: startOfToday },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const accepted = todaysChecks.filter((c) => c.decision === "ACCEPTED").length;
  const rejected = todaysChecks.filter((c) => c.decision === "REJECTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Arrival Inspection</h1>
        <p className="mt-1 text-sm text-slate-500">
          Raw material intake (STR03110) — log every incoming sample, then accept or reject it.
        </p>
      </div>

      <div className="flex gap-4">
        <Badge color="slate">{todaysChecks.length} logged today</Badge>
        <Badge color="green">{accepted} accepted</Badge>
        <Badge color="red">{rejected} rejected</Badge>
      </div>

      <div className="max-w-3xl">
        <ArrivalInspectionForm />
      </div>

      <Card className="max-w-3xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Today&apos;s Log</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Sample / Pallet</th>
              <th className="px-4 py-2 font-medium">Vehicle</th>
              <th className="px-4 py-2 font-medium">Brix</th>
              <th className="px-4 py-2 font-medium">Decision</th>
            </tr>
          </thead>
          <tbody>
            {todaysChecks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 text-slate-500">
                  {c.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">
                  {c.appliesToWholeDelivery ? <span className="text-slate-400">Whole delivery</span> : c.sampleNo ?? "—"}
                </td>
                <td className="px-4 py-2">{c.transportVehicleNo ?? "—"}</td>
                <td className="px-4 py-2">{c.appliesToWholeDelivery ? "—" : c.brix}</td>
                <td className="px-4 py-2">
                  <Badge color={c.decision === "ACCEPTED" ? "green" : "red"}>{c.decision}</Badge>
                </td>
              </tr>
            ))}
            {todaysChecks.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
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
