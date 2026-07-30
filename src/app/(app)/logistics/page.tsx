import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { FORMAT_LABEL } from "@/lib/format";
import Link from "next/link";
import { differenceInDays } from "date-fns";

const CAPACITY_TONNES: Record<"PALLETISED" | "UNPALLETISED", number> = {
  PALLETISED: 24,
  UNPALLETISED: 25,
};

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  const isLoadOutStation = session?.user.station === "LOAD_OUT";
  const { q } = await searchParams;
  const query = q?.trim();

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
          <h1 className="text-xl font-semibold text-slate-900">{isLoadOutStation ? "Load-Out" : "Logistics"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLoadOutStation
              ? "Containers awaiting load-out. Open one to fill the manifest and sign off."
              : "Container tracking: departure, transit, and current location."}
          </p>
        </div>
      </div>

      <Card className="mt-4 p-3">
        <form className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Search any container</label>
            <Input
              name="q"
              defaultValue={query ?? ""}
              placeholder="Container #, seal #, B/L #, order #, or client name"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </Card>

      <Card className="mt-4 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Container #</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Spec</th>
              <th className="px-4 py-2 font-medium">Departure</th>
              <th className="px-4 py-2 font-medium">Destination</th>
              <th className="px-4 py-2 font-medium">Expected Transit</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Current Location</th>
              <th className="px-4 py-2 font-medium">Load Type</th>
              <th className="px-4 py-2 font-medium">Load-Out</th>
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
                    <Badge color={c.order.grade === "A" ? "green" : "amber"}>Grade {c.order.grade}</Badge>{" "}
                    <span className="text-slate-500">{FORMAT_LABEL[c.order.format]}</span>
                  </td>
                  <td className="px-4 py-2">{c.departurePort ?? "—"}</td>
                  <td className="px-4 py-2">{c.destinationPort ?? "—"}</td>
                  <td className="px-4 py-2">{c.expectedTransitDays ? `${c.expectedTransitDays} days` : "—"}</td>
                  <td className="px-4 py-2">
                    {overdue ? <Badge color="red">Overdue</Badge> : <Badge color="blue">{c.order.stage.replace("_", " ")}</Badge>}
                  </td>
                  <td className="px-4 py-2">{c.currentLocation ?? "—"}</td>
                  <td className="px-4 py-2">
                    {c.loadType ? (
                      <Badge color={c.loadType === "PALLETISED" ? "blue" : "amber"}>
                        {c.loadType === "PALLETISED" ? "Palletised" : "Unpalletised"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {loadedTonnes === 0 ? (
                      <Badge color="slate">Not started</Badge>
                    ) : capacity && loadedTonnes >= capacity - 0.5 ? (
                      <Badge color="green">{loadedTonnes.toFixed(1)}t — Full</Badge>
                    ) : (
                      <Badge color="amber">
                        {loadedTonnes.toFixed(1)}t{capacity ? ` / ${capacity}t` : ""}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {containers.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  {query ? `No container matches "${query}".` : "No containers yet. Create one from an order's page."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
