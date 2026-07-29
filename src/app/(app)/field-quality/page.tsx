import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { startOfWeek, startOfMonth } from "date-fns";
import { egyptDateOnly, egyptDayStart } from "@/lib/timezone";
import { FieldQualityTable, type FieldPeriodRow, type Period } from "./field-quality-table";

const PERIODS: Period[] = ["DAILY", "WEEKLY", "MONTHLY"];

export default async function FieldQualityPage() {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    redirect("/");
  }

  const fields = await prisma.field.findMany({ where: { variety: "MS1" }, orderBy: { name: "asc" } });

  // Calendar buckets in Egypt local time -- "Daily" is today's calendar day,
  // not a rolling last-24-hours window, so it lines up with Harvest Report's
  // Daily bucket instead of drifting from it.
  const todayEgypt = egyptDateOnly(new Date());
  const periodStart: Record<Period, Date> = {
    DAILY: todayEgypt,
    WEEKLY: startOfWeek(todayEgypt, { weekStartsOn: 1 }),
    MONTHLY: startOfMonth(todayEgypt),
  };

  // Pre-Decap Arrivals only -- by Post-Decap Quality the fruit from multiple
  // fields has already been mixed at the decap facility, so averaging its
  // measurements against one field would be misleading.
  const checks = await prisma.qualityCheck.findMany({
    where: { checkpoint: "PRE_DECAP", fieldId: { not: null }, createdAt: { gte: egyptDayStart(periodStart.MONTHLY) } },
    select: {
      fieldId: true,
      createdAt: true,
      decision: true,
      brix: true,
      fruitColorPct: true,
      internalQualityPct: true,
      cleaningGoodCratesOk: true,
      overmaturePct: true,
      diameterUnder22mmPct: true,
      botrytisPct: true,
      pestDiseasePct: true,
      wormEatenPct: true,
      bruisesPct: true,
      shapeDeformitiesPct: true,
      sandDustPct: true,
      foreignBodiesPct: true,
    },
  });

  const dataByPeriod: Record<Period, FieldPeriodRow[]> = { DAILY: [], WEEKLY: [], MONTHLY: [] };

  for (const period of PERIODS) {
    const cutoff = egyptDayStart(periodStart[period]).getTime();
    const inWindow = checks.filter((c) => c.createdAt.getTime() >= cutoff);

    const byField = new Map<string, typeof inWindow>();
    for (const c of inWindow) {
      if (!c.fieldId) continue;
      const list = byField.get(c.fieldId) ?? [];
      list.push(c);
      byField.set(c.fieldId, list);
    }

    dataByPeriod[period] = fields
      .map((f) => {
        const rows = byField.get(f.id) ?? [];
        if (rows.length === 0) return null;
        const avg = (get: (r: (typeof rows)[number]) => number | null) => {
          const vals = rows.map(get).filter((v): v is number => v != null);
          return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        };
        const rejected = rows.filter((r) => r.decision === "REJECTED").length;
        const crateChecks = rows.filter((r) => r.cleaningGoodCratesOk != null);
        const cratesOkPct =
          crateChecks.length > 0
            ? (crateChecks.filter((r) => r.cleaningGoodCratesOk).length / crateChecks.length) * 100
            : null;

        return {
          fieldId: f.id,
          fieldName: f.name,
          count: rows.length,
          rejected,
          brix: avg((r) => r.brix),
          fruitColorPct: avg((r) => r.fruitColorPct),
          internalQualityPct: avg((r) => r.internalQualityPct),
          cratesOkPct,
          overmaturePct: avg((r) => r.overmaturePct),
          diameterUnder22mmPct: avg((r) => r.diameterUnder22mmPct),
          botrytisPct: avg((r) => r.botrytisPct),
          pestDiseasePct: avg((r) => r.pestDiseasePct),
          wormEatenPct: avg((r) => r.wormEatenPct),
          bruisesPct: avg((r) => r.bruisesPct),
          shapeDeformitiesPct: avg((r) => r.shapeDeformitiesPct),
          sandDustPct: avg((r) => r.sandDustPct),
          foreignBodiesPct: avg((r) => r.foreignBodiesPct),
        } satisfies FieldPeriodRow;
      })
      .filter((r): r is FieldPeriodRow => r !== null)
      .sort((a, b) => b.rejected / b.count - a.rejected / a.count);
  }

  return (
    <div>
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Field Quality</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every quality band from Pre-Decap Arrivals, rolled up per field — the last checkpoint before fruit from
          multiple fields gets mixed at the decap facility. Fields with the worst rejection rate sort to the top.
        </p>
      </div>

      <div className="mt-6">
        <FieldQualityTable dataByPeriod={dataByPeriod} />
      </div>
    </div>
  );
}
