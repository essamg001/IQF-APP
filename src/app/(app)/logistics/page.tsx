import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Button, LinkButton } from "@/components/ui/button";
import { CAPACITY_TONNES } from "@/lib/logistics";
import { getOrderLifecycleStatus, summarizeLifecycle, type LifecycleStepKey } from "@/lib/orderLifecycle";
import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { differenceInDays } from "date-fns";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { PrintButton } from "@/components/ui/print-button";

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const { q } = await searchParams;
  const query = q?.trim();
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.logistics;
  const loadOutDict = fullDict.loadOut;
  const ordersDict = fullDict.orders;
  const FORMAT_LABEL: Record<string, string> = {
    WHOLE: ordersDict.formatWhole,
    SLICED: ordersDict.formatSliced,
    DICED: ordersDict.formatDiced,
  };
  const STAGE_LABEL: Record<string, string> = {
    CONFIRMED: ordersDict.stageConfirmed,
    IN_PRODUCTION: ordersDict.stageInProduction,
    PACKED: ordersDict.stagePacked,
    SHIPPED: ordersDict.stageShipped,
    DELIVERED: ordersDict.stageDelivered,
    PAID: ordersDict.stagePaid,
  };
  const STEP_LABEL: Record<LifecycleStepKey, string> = {
    CONFIRMED: ordersDict.stageConfirmed,
    ALLOCATED: ordersDict.stepAllocated,
    LAB_CLEARED: ordersDict.stepLabCleared,
    LOADED: ordersDict.stepLoaded,
    SHIPPED: ordersDict.stageShipped,
    DELIVERED: ordersDict.stageDelivered,
    PAID: ordersDict.stagePaid,
  };

  // The order-readiness triage that used to live on its own /load-out page --
  // merged in here since that page had no loading controls of its own (every
  // action on it just forwarded to this one), and a station: "LOAD_OUT"
  // account already lands here, not there. One page, one name.
  const pipelineOrders = await prisma.order.findMany({
    where: { stage: { notIn: ["DELIVERED", "PAID"] } },
    include: {
      client: { include: { specs: true } },
      containers: true,
      pallets: { include: { lot: { include: { microbiologyResults: true, mrlResult: true, shift: true } } } },
    },
    orderBy: { orderDate: "asc" },
  });
  const isReady = (o: (typeof pipelineOrders)[number]) => o.pallets.length > 0 || o.containers.length > 0;
  const readyOrders = pipelineOrders.filter(isReady);
  const notReadyOrders = pipelineOrders.filter((o) => !isReady(o));
  readyOrders.sort((a, b) => {
    const aUncontainered = a.containers.length === 0;
    const bUncontainered = b.containers.length === 0;
    if (aUncontainered !== bUncontainered) return aUncontainered ? -1 : 1;
    return a.orderDate.getTime() - b.orderDate.getTime();
  });
  const pipelineLifecycle = new Map<string, Awaited<ReturnType<typeof getOrderLifecycleStatus>>>();
  for (const o of pipelineOrders) pipelineLifecycle.set(o.id, await getOrderLifecycleStatus(o));

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
        <PrintButton />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-900">
        {loadOutDict.readyToLoadTitle} {readyOrders.length > 0 && <span className="font-normal text-slate-400">({readyOrders.length})</span>}
      </h2>
      <Card className="mt-2 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderNumber}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colClient}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colGradeFormat}</th>
              <th className="px-4 py-2 font-medium">{loadOutDict.colStage}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colAllocated}</th>
              <th className="px-4 py-2 font-medium">{ordersDict.colOrderDate}</th>
              <th className="px-4 py-2 font-medium">{loadOutDict.colLoadOutStatus}</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {readyOrders.map((o) => {
              const summary = summarizeLifecycle(pipelineLifecycle.get(o.id)!);
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
                      {o.orderNumber}
                    </Link>
                    {o.poNumber && (
                      <p className="text-xs text-slate-400">
                        {ordersDict.poPrefix} {o.poNumber}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2">{o.client.name}</td>
                  <td className="px-4 py-2">
                    {ordersDict.gradeLabel.replace("{grade}", o.grade)} · {FORMAT_LABEL[o.format]}
                  </td>
                  <td className="px-4 py-2">
                    <Badge color={summary.tone === "blocked" ? "amber" : summary.tone === "done" ? "green" : "blue"}>
                      {STEP_LABEL[summary.key]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    {o.pallets.length} / {o.quantityPallets}
                  </td>
                  <td className="px-4 py-2">{formatDate(o.orderDate, "dd MMM yyyy", locale)}</td>
                  <td className="px-4 py-2">
                    {o.containers.length === 0 ? (
                      <Badge color="slate">{loadOutDict.notYetAssigned}</Badge>
                    ) : (
                      <div className="space-y-1">
                        {o.containers.map((c) => (
                          <Link key={c.id} href={`/logistics/${c.id}`} className="block text-emerald-700 hover:underline">
                            {c.containerNumber}
                            {c.departureDate && ` — ${formatDate(c.departureDate, "dd MMM yyyy", locale)}`}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="no-print px-4 py-2">
                    <LinkButton href={`/logistics/new?orderId=${o.id}`} variant="secondary" className="text-xs">
                      {o.containers.length === 0 ? loadOutDict.takeToLoadOut : loadOutDict.addAnotherContainer}
                    </LinkButton>
                  </td>
                </tr>
              );
            })}
            {readyOrders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {loadOutDict.noReadyOrders}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {notReadyOrders.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-700">
            {loadOutDict.awaitingProductionTitle.replace("{count}", String(notReadyOrders.length))}
          </summary>
          <Card className="mt-2 overflow-x-auto p-0">
            <table className="w-full text-start text-sm">
              <tbody>
                {notReadyOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/orders/${o.id}`} className="font-medium text-emerald-700 hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{o.client.name}</td>
                    <td className="px-4 py-2">
                      {ordersDict.gradeLabel.replace("{grade}", o.grade)} · {FORMAT_LABEL[o.format]}
                    </td>
                    <td className="px-4 py-2">{formatDate(o.orderDate, "dd MMM yyyy", locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </details>
      )}

      <h2 className="mt-6 text-sm font-semibold text-slate-900">{dict.containersHeading}</h2>
      <Card className="no-print mt-2 p-3">
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
