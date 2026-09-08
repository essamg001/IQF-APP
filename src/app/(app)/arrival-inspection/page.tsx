import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrivalInspectionForm } from "./arrival-form";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function ArrivalInspectionPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }
  const dict = getDictionary(await resolveLocale()).arrivalInspection;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const [todaysChecks, harvestTickets, factories] = await Promise.all([
    prisma.qualityCheck.findMany({
      where: {
        checkpoint: "RAW_MATERIAL",
        lotId: null,
        createdAt: { gte: startOfToday },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    // So the delivery's own Harvest Ticket data (vehicle, farm, variety) can
    // be cross-checked/auto-filled instead of re-typed by hand with nothing
    // to catch a typo against the wrong ticket.
    prisma.harvestTicket.findMany({
      where: { createdAt: { gte: fourteenDaysAgo } },
      select: {
        id: true,
        serialNumber: true,
        vehicleNo: true,
        authorizedGrower: true,
        plotLines: { select: { varietyName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.factory.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const accepted = todaysChecks.filter((c) => c.decision === "ACCEPTED").length;
  const rejected = todaysChecks.filter((c) => c.decision === "REJECTED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
        </div>
        <PrintButton />
      </div>

      <div className="flex gap-4">
        <Badge color="slate">
          {todaysChecks.length} {dict.loggedTodaySuffix}
        </Badge>
        <Badge color="green">
          {accepted} {dict.acceptedSuffix}
        </Badge>
        <Badge color="red">
          {rejected} {dict.rejectedSuffix}
        </Badge>
      </div>

      <div className="no-print max-w-3xl">
        <ArrivalInspectionForm
          todaysChecks={todaysChecks.map((c) => ({
            receiptNoteNo: c.receiptNoteNo,
            appliesToWholeDelivery: c.appliesToWholeDelivery,
          }))}
          harvestTickets={harvestTickets}
          factories={factories}
        />
      </div>

      <Card className="max-w-3xl overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">{dict.todaysLogTitle}</h2>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colTime}</th>
              <th className="px-4 py-2 font-medium">{dict.colSamplePallet}</th>
              <th className="px-4 py-2 font-medium">{dict.colVehicle}</th>
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
                <td className="px-4 py-2">
                  <Link href={`/quality-check/${c.id}`} className="text-emerald-700 hover:underline">
                    {c.appliesToWholeDelivery ? dict.wholeDelivery : c.sampleNo ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.transportVehicleNo ?? "—"}</td>
                <td className="px-4 py-2">{c.appliesToWholeDelivery ? "—" : c.brix}</td>
                <td className="px-4 py-2">
                  {c.totalDefectsPct != null ? (
                    <Badge color={c.totalDefectsPct > 5 ? "red" : "green"}>{c.totalDefectsPct.toFixed(1)}%</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge color={c.decision === "ACCEPTED" ? "green" : "red"}>
                    {c.decision === "ACCEPTED" ? dict.acceptable : dict.unacceptable}
                  </Badge>
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
