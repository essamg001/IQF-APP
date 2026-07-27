import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Stage = "PRE_DECAP" | "POST_DECAP";

type StageStats = {
  count: number;
  rejected: number;
  totalDefectsSum: number;
  totalDefectsCount: number;
  brixSum: number;
  brixCount: number;
};

function emptyStats(): StageStats {
  return { count: 0, rejected: 0, totalDefectsSum: 0, totalDefectsCount: 0, brixSum: 0, brixCount: 0 };
}

export default async function FieldQualityPage() {
  const [fields, checks] = await Promise.all([
    prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } }),
    prisma.qualityCheck.findMany({
      where: { checkpoint: { in: ["PRE_DECAP", "POST_DECAP"] }, fieldId: { not: null } },
      select: { fieldId: true, checkpoint: true, decision: true, totalDefectsPct: true, brix: true },
    }),
  ]);

  // fieldId -> stage -> aggregated stats, computed in JS since it spans two
  // checkpoints per field and Prisma's groupBy doesn't average cleanly across
  // a filtered enum split like this in one query.
  const byField = new Map<string, Record<Stage, StageStats>>();
  for (const f of fields) {
    byField.set(f.id, { PRE_DECAP: emptyStats(), POST_DECAP: emptyStats() });
  }
  for (const c of checks) {
    if (!c.fieldId) continue;
    const entry = byField.get(c.fieldId);
    if (!entry) continue; // non-MS1 field, shouldn't happen but guard anyway
    const stats = entry[c.checkpoint as Stage];
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
    .filter((r) => r.stats.PRE_DECAP.count > 0 || r.stats.POST_DECAP.count > 0)
    .sort((a, b) => {
      const avgA = avgDefects(a.stats.PRE_DECAP) + avgDefects(a.stats.POST_DECAP);
      const avgB = avgDefects(b.stats.PRE_DECAP) + avgDefects(b.stats.POST_DECAP);
      return avgB - avgA;
    });

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Field Quality</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defect rates, rejections, and Brix rolled up per field from Pre-Decap Arrivals and Post-Decap Quality —
          fields with the worst quality sort to the top.
        </p>
      </div>

      <Card className="mt-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Field</th>
              <th className="px-4 py-2 font-medium">Pre-Decap Checks</th>
              <th className="px-4 py-2 font-medium">Pre-Decap Rejected</th>
              <th className="px-4 py-2 font-medium">Pre-Decap Avg Defects</th>
              <th className="px-4 py-2 font-medium">Pre-Decap Avg Brix</th>
              <th className="px-4 py-2 font-medium">Post-Decap Checks</th>
              <th className="px-4 py-2 font-medium">Post-Decap Rejected</th>
              <th className="px-4 py-2 font-medium">Post-Decap Avg Defects</th>
              <th className="px-4 py-2 font-medium">Post-Decap Avg Brix</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ field, stats }) => (
              <tr key={field.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-800">{field.name}</td>
                <StageCells stats={stats.PRE_DECAP} />
                <StageCells stats={stats.POST_DECAP} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                  No Pre-Decap or Post-Decap Quality checks logged against a field yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function avgDefects(s: StageStats): number {
  return s.totalDefectsCount > 0 ? s.totalDefectsSum / s.totalDefectsCount : 0;
}

function StageCells({ stats }: { stats: StageStats }) {
  if (stats.count === 0) {
    return (
      <>
        <td className="px-4 py-2 text-slate-400">—</td>
        <td className="px-4 py-2 text-slate-400">—</td>
        <td className="px-4 py-2 text-slate-400">—</td>
        <td className="px-4 py-2 text-slate-400">—</td>
      </>
    );
  }
  const rejectionRate = (stats.rejected / stats.count) * 100;
  const avgDefectsPct = avgDefects(stats);
  const avgBrix = stats.brixCount > 0 ? stats.brixSum / stats.brixCount : null;

  return (
    <>
      <td className="px-4 py-2">{stats.count}</td>
      <td className="px-4 py-2">
        <Badge color={rejectionRate > 10 ? "red" : rejectionRate > 0 ? "amber" : "green"}>
          {stats.rejected} ({rejectionRate.toFixed(0)}%)
        </Badge>
      </td>
      <td className="px-4 py-2">{avgDefectsPct.toFixed(1)}%</td>
      <td className="px-4 py-2">{avgBrix != null ? avgBrix.toFixed(1) : "—"}</td>
    </>
  );
}
