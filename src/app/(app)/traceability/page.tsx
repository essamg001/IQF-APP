import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { FORMAT_LABEL } from "@/lib/format";

const PALLET_STATUS_COLOR = {
  IN_STORAGE: "slate",
  ALLOCATED: "blue",
  SHIPPED: "green",
  WASTE: "red",
  DISCOUNT_OFFERED: "amber",
} as const;

export default async function TraceabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ field?: string }>;
}) {
  const { field: fieldName } = await searchParams;

  const fields = await prisma.field.findMany({
    where: { farmName: { not: null }, variety: "MS1" },
    orderBy: [{ farmName: "asc" }, { station: "asc" }, { valve: "asc" }],
  });

  const field = fieldName ? fields.find((f) => f.name === fieldName.trim()) : undefined;
  const notFoundMessage = fieldName && !field ? `Plot "${fieldName}" not found — pick one from the list.` : undefined;

  let directLots: Awaited<ReturnType<typeof loadDirectLots>> = [];
  let possibleLots: Awaited<ReturnType<typeof loadDirectLots>> = [];
  let preDecapRecords: Awaited<ReturnType<typeof loadPreDecapRecords>> = [];

  if (field) {
    [directLots, preDecapRecords] = await Promise.all([loadDirectLots(field.id), loadPreDecapRecords(field.id)]);

    const contributingChecks = await prisma.qualityCheck.findMany({
      where: { checkpoint: "POST_DECAP", decision: "ACCEPTED", fieldId: field.id },
      select: { createdAt: true },
    });

    if (contributingChecks.length > 0) {
      const times = contributingChecks.map((c) => c.createdAt.getTime());
      const minTime = new Date(Math.min(...times));
      const maxTime = new Date(Math.max(...times));

      const candidateLots = await prisma.productionLot.findMany({
        where: {
          fieldId: { not: field.id },
          shift: { startTime: { lte: maxTime }, endTime: { gte: minTime } },
        },
        include: lotInclude,
      });

      possibleLots = candidateLots.filter((lot) =>
        times.some((t) => t >= lot.shift.startTime.getTime() && t <= lot.shift.endTime.getTime())
      );
    }
  }

  const affectedLots = [...directLots, ...possibleLots];
  const allPallets = affectedLots.flatMap((lot) => lot.pallets.map((p) => ({ ...p, lotNumber: lot.lotNumber })));
  const affectedClients = [...new Map(allPallets.filter((p) => p.client).map((p) => [p.client!.id, p.client!.name])).values()];
  const inStoragePallets = allPallets.filter((p) => p.status === "IN_STORAGE" || p.status === "ALLOCATED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Traceability / Recall Lookup</h1>
        <p className="mt-1 text-sm text-slate-500">
          Given a field, find every Lot, Pallet, and Order it could have touched — the reverse of the field-level
          quality reports. Use this to scope a recall or a client inquiry to exactly what&apos;s affected.
        </p>
      </div>

      <Card>
        <form className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Field / Plot</label>
            <Input name="field" defaultValue={fieldName ?? ""} list="traceability-field-suggestions" placeholder="e.g. MAFA 4 · ST1 · A1" />
            <datalist id="traceability-field-suggestions">
              {fields.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
          </div>
          <Button type="submit">Look up</Button>
        </form>
        {notFoundMessage && <p className="mt-2 text-sm text-red-600">{notFoundMessage}</p>}
      </Card>

      {field && (
        <>
          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Summary — {field.name}</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-900">{affectedLots.length}</strong> lots affected
              </span>
              <span>
                <strong className="text-slate-900">{allPallets.length}</strong> pallets affected
              </span>
              <span>
                <strong className="text-slate-900">{inStoragePallets.length}</strong> still in storage / allocated
              </span>
              <span>
                <strong className="text-slate-900">{affectedClients.length}</strong> clients touched
              </span>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Pre-Decap Arrival Records</h2>
            <p className="mt-1 text-xs text-slate-500">
              Direct deliveries logged from this field, before decapping and mixing.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Sample</th>
                    <th className="py-2 pr-4 font-medium">Receipt Note</th>
                    <th className="py-2 pr-4 font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {preDecapRecords.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">{format(r.createdAt, "dd MMM yyyy HH:mm")}</td>
                      <td className="py-2 pr-4">{r.sampleNo ?? "—"}</td>
                      <td className="py-2 pr-4">{r.receiptNoteNo ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge color={r.decision === "ACCEPTED" ? "green" : "red"}>{r.decision}</Badge>
                      </td>
                    </tr>
                  ))}
                  {preDecapRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No Pre-Decap records for this field.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Affected Lots</h2>
            <p className="mt-1 text-xs text-slate-500">
              Fruit is mixed at the decap facility, so a lot isn&apos;t traceable to one exact field. &quot;Direct&quot;
              lots were nominally assigned to this field; &quot;Possible&quot; lots had this field&apos;s fruit clear
              Post-Decap Quality during their shift window, so it may be present in the mix.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Lot</th>
                    <th className="py-2 pr-4 font-medium">Factory</th>
                    <th className="py-2 pr-4 font-medium">Shift Date</th>
                    <th className="py-2 pr-4 font-medium">Grade</th>
                    <th className="py-2 pr-4 font-medium">Format</th>
                    <th className="py-2 pr-4 font-medium">Pallets</th>
                    <th className="py-2 pr-4 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {directLots.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">{lot.lotNumber}</td>
                      <td className="py-2 pr-4">{lot.factory.name}</td>
                      <td className="py-2 pr-4">{format(lot.shift.date, "dd MMM yyyy")}</td>
                      <td className="py-2 pr-4">
                        <Badge color={lot.grade === "A" ? "green" : "amber"}>Grade {lot.grade}</Badge>
                      </td>
                      <td className="py-2 pr-4">{FORMAT_LABEL[lot.format]}</td>
                      <td className="py-2 pr-4">{lot.pallets.length}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/production/${lot.id}`} className="text-emerald-700 hover:underline">
                          <Badge color="blue">Direct</Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {possibleLots.map((lot) => (
                    <tr key={lot.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">{lot.lotNumber}</td>
                      <td className="py-2 pr-4">{lot.factory.name}</td>
                      <td className="py-2 pr-4">{format(lot.shift.date, "dd MMM yyyy")}</td>
                      <td className="py-2 pr-4">
                        <Badge color={lot.grade === "A" ? "green" : "amber"}>Grade {lot.grade}</Badge>
                      </td>
                      <td className="py-2 pr-4">{FORMAT_LABEL[lot.format]}</td>
                      <td className="py-2 pr-4">{lot.pallets.length}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/production/${lot.id}`} className="text-emerald-700 hover:underline">
                          <Badge color="amber">Possible</Badge>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {affectedLots.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        No lots affected by this field.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Affected Pallets</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Pallet</th>
                    <th className="py-2 pr-4 font-medium">Lot</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {allPallets.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">{p.palletNumber}</td>
                      <td className="py-2 pr-4">{p.lotNumber}</td>
                      <td className="py-2 pr-4">
                        <Badge color={PALLET_STATUS_COLOR[p.status]}>{p.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="py-2 pr-4">{p.client?.name ?? "—"}</td>
                    </tr>
                  ))}
                  {allPallets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        No pallets affected.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-slate-900">Clients Touched</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {affectedClients.map((name) => (
                <Badge key={name} color="slate">
                  {name}
                </Badge>
              ))}
              {affectedClients.length === 0 && <p className="text-sm text-slate-400">No clients touched yet.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const lotInclude = {
  shift: { include: { factory: true } },
  factory: true,
  pallets: { include: { client: true } },
} as const;

function loadDirectLots(fieldId: string) {
  return prisma.productionLot.findMany({
    where: { fieldId },
    include: lotInclude,
    orderBy: { createdAt: "desc" },
  });
}

function loadPreDecapRecords(fieldId: string) {
  return prisma.qualityCheck.findMany({
    where: { checkpoint: "PRE_DECAP", fieldId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
