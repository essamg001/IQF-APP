import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type FieldStats = {
  count: number;
  rejected: number;
  totalDefectsSum: number;
  totalDefectsCount: number;
  brixSum: number;
  brixCount: number;
};

function emptyStats(): FieldStats {
  return { count: 0, rejected: 0, totalDefectsSum: 0, totalDefectsCount: 0, brixSum: 0, brixCount: 0 };
}

function avgDefects(s: FieldStats): number {
  return s.totalDefectsCount > 0 ? s.totalDefectsSum / s.totalDefectsCount : 0;
}

export default async function FieldQualityPage() {
  const [fields, checks] = await Promise.all([
    prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } }),
    // Pre-Decap Arrivals only -- by Post-Decap Quality the fruit from
    // multiple fields has already been mixed at the decap facility, so
    // averaging its measurements against one field would be misleading.
    prisma.qualityCheck.findMany({
      where: { checkpoint: "PRE_DECAP", fieldId: { not: null } },
      select: { fieldId: true, decision: true, totalDefectsPct: true, brix: true },
    }),
  ]);

  const byField = new Map<string, FieldStats>();
  for (const f of fields) byField.set(f.id, emptyStats());
  for (const c of checks) {
    if (!c.fieldId) continue;
    const stats = byField.get(c.fieldId);
    if (!stats) continue; // non-MS1 field, shouldn't happen but guard anyway
    stats.count += 1;
    if (c.decision === "REJECTED") stats.rejected += 1;
    if (c.totalDefectsPct != null) {
      stats.totalDefectsSum += c.totalDefectsPct;
      stats.totalDefectsCount += 1;
    }
    if (c.brix != null) {
      stats.brixSum += c.brix;
      stats.brixCount += 1;
    }
  }

  const rows = fields
    .map((f) => ({ field: f, stats: byField.get(f.id)! }))
    .filter((r) => r.stats.count > 0)
    .sort((a, b) => avgDefects(b.stats) - avgDefects(a.stats));

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Field Quality</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defect rates, rejections, and Brix rolled up per field from Pre-Decap Arrivals — the last point before
          fruit from multiple fields gets mixed at the decap facility. Fields with the worst quality sort to the top.
        </p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Checks</th>
              <th className="px-4 py-2 font-medium">Rejected</th>
              <th className="px-4 py-2 font-medium">Avg Defects</th>
              <th className="px-4 py-2 font-medium">Avg Brix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, stats }) => {
              const rejectionRate = (stats.rejected / stats.count) * 100;
              const avgBrix = stats.brixCount > 0 ? stats.brixSum / stats.brixCount : null;
              return (
                <tr key={field.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{field.name}</td>
                  <td className="px-4 py-2">{stats.count}</td>
                  <td className="px-4 py-2">
                    <Badge color={rejectionRate > 10 ? "red" : rejectionRate > 0 ? "amber" : "green"}>
                      {stats.rejected} ({rejectionRate.toFixed(0)}%)
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{avgDefects(stats).toFixed(1)}%</td>
                  <td className="px-4 py-2">{avgBrix != null ? avgBrix.toFixed(1) : "—"}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No Pre-Decap Arrival checks logged against a field yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
