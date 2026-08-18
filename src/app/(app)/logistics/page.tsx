import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL } from "@/lib/format";
import { CAPACITY_TONNES } from "@/lib/logistics";
import Link from "next/link";
import { differenceInDays } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const { q } = await searchParams;
  const query = q?.trim();
  const fullDict = getDictionary(await resolveLocale());
  const dict = fullDict.logistics;
  const ordersDict = fullDict.orders;
  const STAGE_LABEL: Record<string, string> = {
    CONFIRMED: ordersDict.stageConfirmed,
    IN_PRODUCTION: ordersDict.stageInProduction,
    PACKED: ordersDict.stagePacked,
    SHIPPED: ordersDict.stageShipped,
    DELIVERED: ordersDict.stageDelivered,
    PAID: ordersDict.stagePaid,
  };

  // A search looks across every container ever created, not just the recent
  // 200 shown by default -- finding an old container's historical record is
  // the whole point of searching in the first place.
  const allContainers = await prisma.container.findMany({
    where: query
      ? {
          OR: [
            { containerNumber: { contains: query, mode: "insensitive" } },
            { order: { orderNumber: { contains: query, mode: "insensitive" } } },
            { order: { client: { name: { contains: query, mode: "insensitive" } } } },
            { sealNumber: { contains: query, mode: "insensitive" } },
            { billOfLadingNumber: { contains: query, mode: "insensitive" } },
            { bolsaPermitNumber: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: {
      order: { include: { client: true } },
      palletLines: { select: { quantityTonnes: true } },
    },
    orderBy: { createdAt: "desc" },
    take: query ? undefined : 200,
  });

  const containers = isLoadOutStation
    ? allContainers.filter((c) => !(c.loadOutSignedAt && c.qualitySignedAt))
    : allContainers;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{isLoadOutStation ? dict.titleLoadOut : dict.titleLogistics}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoadOutStation ? dict.subtitleLoadOut : dict.subtitleLogistics}
          </p>
        </div>
      </div>

      <Card className="mt-4 p-3">
        <form className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">{dict.searchLabel}</label>
            <Input
              name="q"
              defaultValue={query ?? ""}
              placeholder={dict.searchPlaceholder}
            />
          </div>
          <Button type="submit" variant="secondary">
            {dict.searchButton}
          </Button>
        </form>
      </Card>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colContainerNo}</th>
              <th className="px-4 py-2 font-medium">{dict.colClient}</th>
              <th className="px-4 py-2 font-medium">{dict.colSpec}</th>
              <th className="px-4 py-2 font-medium">{dict.colDeparture}</th>
              <th className="px-4 py-2 font-medium">{dict.colDestination}</th>
              <th className="px-4 py-2 font-medium">{dict.colExpectedTransit}</th>
              <th className="px-4 py-2 font-medium">{dict.colStatus}</th>
              <th className="px-4 py-2 font-medium">{dict.colCurrentLocation}</th>
              <th className="px-4 py-2 font-medium">{dict.colLoadType}</th>
              <th className="px-4 py-2 font-medium">{dict.colLoadOut}</th>
              <th className="px-4 py-2 font-medium">{dict.colBolsaPermit}</th>
            </tr>
          </thead>
          <tbody>
            {containers.map((c) => {
              const overdue =
                c.departureDate &&
                c.expectedTransitDays &&
                differenceInDays(new Date(), c.departureDate) > c.expectedTransitDays &&
                c.order.stage !== "DELIVERED" &&
                c.order.stage !== "PAID";
              const loadedTonnes = c.palletLines.reduce((s, l) => s + l.quantityTonnes, 0);
              const capacity = c.loadType ? CAPACITY_TONNES[c.loadType] : null;
              return (
                <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/logistics/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                      {c.containerNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{c.order.client.name}</td>
                  <td className="px-4 py-2">
                    <Badge color={c.order.grade === "A" ? "green" : "amber"}>{dict.gradeLabel.replace("{grade}", c.order.grade)}</Badge>{" "}
                    <span className="text-slate-500">{FORMAT_LABEL[c.order.format]}</span>
                  </td>
                  <td className="px-4 py-2">{c.departurePort ?? "—"}</td>
                  <td className="px-4 py-2">{c.destinationPort ?? "—"}</td>
                  <td className="px-4 py-2">
                    {c.expectedTransitDays ? dict.daysSuffix.replace("{days}", String(c.expectedTransitDays)) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {overdue ? <Badge color="red">{dict.overdue}</Badge> : <Badge color="blue">{STAGE_LABEL[c.order.stage] ?? c.order.stage}</Badge>}
                  </td>
                  <td className="px-4 py-2">{c.currentLocation ?? "—"}</td>
                  <td className="px-4 py-2">
                    {c.loadType ? (
                      <Badge color={c.loadType === "PALLETISED" ? "blue" : "amber"}>
                        {c.loadType === "PALLETISED" ? dict.palletised : dict.unpalletised}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {loadedTonnes === 0 ? (
                      <Badge color="slate">{dict.notStarted}</Badge>
                    ) : capacity && loadedTonnes >= capacity - 0.5 ? (
                      <Badge color="green">{dict.fullSuffix.replace("{loaded}", loadedTonnes.toFixed(1))}</Badge>
                    ) : (
                      <Badge color="amber">
                        {dict.loadedOfCapacity
                          .replace("{loaded}", loadedTonnes.toFixed(1))
                          .replace("{capacitySuffix}", capacity ? ` / ${capacity}t` : "")}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {c.bolsaPermitNumber ? (
                      <Badge color="green">{dict.onFile}</Badge>
                    ) : loadedTonnes > 0 ? (
                      <Badge color="red">{dict.missing}</Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {containers.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  {query ? dict.noContainerMatches.replace("{query}", query) : dict.noContainersYet}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
