import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";

export default async function HarvestTicketsPage() {
  const tickets = await prisma.harvestTicket.findMany({
    include: { plotLines: true, _count: { select: { plotLines: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Harvest Tickets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Product delivery sheet (GEN03107) — every tractor arriving at the decap facility must have one. Records
            which plots (and how many crates from each) made up the delivery.
          </p>
        </div>
        <LinkButton href="/harvest-tickets/new">New Harvest Ticket</LinkButton>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Serial Number</th>
              <th className="px-4 py-2 font-medium">Harvest Date</th>
              <th className="px-4 py-2 font-medium">Vehicle</th>
              <th className="px-4 py-2 font-medium">Plots</th>
              <th className="px-4 py-2 font-medium">Total Crates</th>
              <th className="px-4 py-2 font-medium">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const totalCrates = t.plotLines.reduce((s, l) => s + (l.cratesCount ?? 0), 0);
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/harvest-tickets/${t.id}`} className="font-medium text-emerald-700 hover:underline">
                      {t.serialNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{t.harvestDate ? format(t.harvestDate, "dd MMM yyyy") : "—"}</td>
                  <td className="px-4 py-2">{t.vehicleNo ?? "—"}</td>
                  <td className="px-4 py-2">{t._count.plotLines}</td>
                  <td className="px-4 py-2">{totalCrates || "—"}</td>
                  <td className="px-4 py-2">
                    {t.receivedDate ? (
                      <Badge color={t.acceptedAtPackhouse ? "green" : "red"}>
                        {t.acceptedAtPackhouse ? "Accepted" : "Rejected"}
                      </Badge>
                    ) : (
                      <Badge color="amber">Awaiting Receipt</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {tickets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No harvest tickets logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
