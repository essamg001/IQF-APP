import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { Grade, Format } from "@prisma/client";
import { bothLabsApprovedFilter, notBothLabsApprovedFilter } from "@/lib/microbiology";
import { isMrlCleared } from "@/lib/mrl";
import { FULL_PALLET_WEIGHT_TONNES } from "@/lib/logistics";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";

const GRADES: Grade[] = ["A", "B"];
const FORMATS: Format[] = ["WHOLE", "SLICED", "DICED"];

export default async function AvailableToSellPage({
  searchParams,
}: {
  searchParams: Promise<{ highlight?: string }>;
}) {
  const { highlight } = await searchParams;
  const locale = await resolveLocale();
  const fullDict = getDictionary(locale);
  const dict = fullDict.availableToSell;
  const orders = fullDict.orders;
  const FORMAT_LABEL: Record<Format, string> = {
    WHOLE: orders.formatWhole,
    SLICED: orders.formatSliced,
    DICED: orders.formatDiced,
  };

  const [readyPallets, pendingMicroPallets, pendingOrders] = await Promise.all([
    prisma.pallet.findMany({
      where: {
        status: "IN_STORAGE",
        lot: { shift: { is: { onHold: false } }, ...bothLabsApprovedFilter },
      },
      select: { weightTonnes: true, lot: { select: { grade: true, format: true, mrlResult: true } } },
    }),
    prisma.pallet.findMany({
      where: {
        status: "IN_STORAGE",
        lot: { OR: [{ shift: { is: { onHold: true } } }, notBothLabsApprovedFilter] },
      },
      select: { weightTonnes: true, lot: { select: { grade: true, format: true } } },
    }),
    prisma.order.findMany({
      // Legacy IN_PRODUCTION/PACKED rows can still exist (those stages were
      // retired from the manual sequence but not the enum, for old data) --
      // still counts as pending demand until it actually ships. A cancelled
      // order's pallets were already released back to stock, so its demand
      // is gone too -- excluded here, or this would keep showing a
      // shortfall for stock nobody needs anymore.
      where: { stage: { in: ["CONFIRMED", "IN_PRODUCTION", "PACKED"] }, cancelledAt: null },
      select: { grade: true, format: true, quantityPallets: true, _count: { select: { pallets: true } } },
    }),
  ]);

  const rows = GRADES.flatMap((grade) =>
    FORMATS.map((format) => {
      const ready = readyPallets.filter(
        (p) => p.lot.grade === grade && p.lot.format === format && isMrlCleared(p.lot.mrlResult)
      );
      const pendingMicro = pendingMicroPallets.filter((p) => p.lot.grade === grade && p.lot.format === format);
      const committed = pendingOrders
        .filter((o) => o.grade === grade && o.format === format)
        .reduce((s, o) => s + Math.max(0, o.quantityPallets - o._count.pallets), 0);

      const readyPalletCount = ready.length;
      const readyTonnes = ready.reduce((s, p) => s + p.weightTonnes, 0);
      const availablePallets = readyPalletCount - committed;
      const availableTonnes = availablePallets * FULL_PALLET_WEIGHT_TONNES;

      return {
        grade,
        format,
        readyPalletCount,
        readyTonnes,
        committed,
        availablePallets,
        availableTonnes,
        pendingMicroCount: pendingMicro.length,
        pendingMicroTonnes: pendingMicro.reduce((s, p) => s + p.weightTonnes, 0),
      };
    })
  ).filter((r) => r.readyPalletCount > 0 || r.committed > 0 || r.pendingMicroCount > 0);

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{dict.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{dict.subtitle}</p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">{dict.colGradeFormat}</th>
              <th className="px-4 py-2 font-medium">{dict.colReadyToSell}</th>
              <th className="px-4 py-2 font-medium">{dict.colCommitted}</th>
              <th className="px-4 py-2 font-medium">{dict.title}</th>
              <th className="px-4 py-2 font-medium">{dict.colPendingMicro}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={`${r.grade}-${r.format}`}
                className={cn(
                  "border-b border-slate-100 last:border-0 hover:bg-slate-50",
                  highlight === `${r.grade}-${r.format}` && "bg-amber-50 ring-1 ring-inset ring-amber-300"
                )}
              >
                <td className="px-4 py-2">
                  <Badge color={r.grade === "A" ? "green" : "amber"}>{orders.gradeLabel.replace("{grade}", r.grade)}</Badge>{" "}
                  <span className="text-slate-700">{FORMAT_LABEL[r.format]}</span>
                </td>
                <td className="px-4 py-2">
                  {r.readyPalletCount} {orders.palletsSuffix} <span className="text-slate-400">({r.readyTonnes.toFixed(1)}t)</span>
                </td>
                <td className="px-4 py-2">
                  {r.committed} {orders.palletsSuffix}
                </td>
                <td className="px-4 py-2">
                  {r.availablePallets < 0 ? (
                    <Badge color="red">
                      {dict.shortBySuffix
                        .replace("{count}", String(Math.abs(r.availablePallets)))
                        .replace("{tonnes}", Math.abs(r.availableTonnes).toFixed(1))}
                    </Badge>
                  ) : r.availablePallets === 0 ? (
                    <Badge color="slate">{dict.fullyCommitted}</Badge>
                  ) : (
                    <Badge color="green">
                      {dict.availableSuffix
                        .replace("{count}", String(r.availablePallets))
                        .replace("{tonnes}", r.availableTonnes.toFixed(1))}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {r.pendingMicroCount > 0
                    ? dict.availableSuffix
                        .replace("{count}", String(r.pendingMicroCount))
                        .replace("{tonnes}", r.pendingMicroTonnes.toFixed(1))
                    : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {dict.noStockOrOrders}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="mt-4 text-xs text-slate-400">{dict.footnote}</p>
    </div>
  );
}
