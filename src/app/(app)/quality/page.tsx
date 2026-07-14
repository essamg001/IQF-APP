import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default async function QualityPage() {
  const checks = await prisma.qualityCheck.findMany({
    include: { lot: { include: { shift: { include: { factory: true } } } }, inspector: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const shiftGroups = new Map<
    string,
    { label: string; factory: string; brix: number[]; mould: number[]; skin: number[]; internal: number[] }
  >();
  for (const c of checks) {
    const shift = c.lot.shift;
    const key = shift.id;
    if (!shiftGroups.has(key)) {
      shiftGroups.set(key, {
        label: format(shift.date, "dd MMM yyyy"),
        factory: shift.factory.name,
        brix: [],
        mould: [],
        skin: [],
        internal: [],
      });
    }
    const g = shiftGroups.get(key)!;
    g.brix.push(c.brix);
    g.mould.push(c.mouldPct);
    g.skin.push(c.skinDamagePct);
    g.internal.push(c.internalQualityPct);
  }
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quality Reports</h1>
          <p className="mt-1 text-sm text-slate-500">Raw-material and post-packaging checks, tied to production lots.</p>
        </div>
        <LinkButton href="/quality/new">Log Quality Check</LinkButton>
      </div>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Shift Averages</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Shift Date</th>
              <th className="px-4 py-2 font-medium">Factory</th>
              <th className="px-4 py-2 font-medium">Avg Brix</th>
              <th className="px-4 py-2 font-medium">Avg Mould %</th>
              <th className="px-4 py-2 font-medium">Avg Skin Damage %</th>
              <th className="px-4 py-2 font-medium">Avg Internal Quality %</th>
            </tr>
          </thead>
          <tbody>
            {[...shiftGroups.values()].map((g, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{g.label}</td>
                <td className="px-4 py-2">{g.factory}</td>
                <td className="px-4 py-2">{avg(g.brix).toFixed(1)}</td>
                <td className="px-4 py-2">{avg(g.mould).toFixed(1)}</td>
                <td className="px-4 py-2">{avg(g.skin).toFixed(1)}</td>
                <td className="px-4 py-2">{avg(g.internal).toFixed(1)}</td>
              </tr>
            ))}
            {shiftGroups.size === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No quality checks logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="px-4 py-3 text-sm font-semibold text-slate-900">Individual Checks</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lot</th>
              <th className="px-4 py-2 font-medium">Checkpoint</th>
              <th className="px-4 py-2 font-medium">Brix</th>
              <th className="px-4 py-2 font-medium">Size/Caliber</th>
              <th className="px-4 py-2 font-medium">Fruit Color %</th>
              <th className="px-4 py-2 font-medium">Mould %</th>
              <th className="px-4 py-2 font-medium">Skin %</th>
              <th className="px-4 py-2 font-medium">Internal %</th>
              <th className="px-4 py-2 font-medium">Inspector</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <a href={`/production/${c.lot.id}`} className="text-emerald-700 hover:underline">
                    {c.lot.lotNumber}
                  </a>
                </td>
                <td className="px-4 py-2">
                  <Badge color={c.checkpoint === "RAW_MATERIAL" ? "blue" : "green"}>
                    {c.checkpoint === "RAW_MATERIAL" ? "Raw Material" : "Post-Packaging"}
                  </Badge>
                </td>
                <td className="px-4 py-2">{c.brix}</td>
                <td className="px-4 py-2">{c.sizeCaliber ?? "—"}</td>
                <td className="px-4 py-2">{c.fruitColorPct}</td>
                <td className="px-4 py-2">{c.mouldPct}</td>
                <td className="px-4 py-2">{c.skinDamagePct}</td>
                <td className="px-4 py-2">{c.internalQualityPct}</td>
                <td className="px-4 py-2">{c.inspector?.name ?? "—"}</td>
              </tr>
            ))}
            {checks.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No quality checks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
