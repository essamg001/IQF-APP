"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CLEANING_LOW_SCORE_THRESHOLD } from "@/lib/cleaning";

const PRODUCTION_COLOR = "#0ea5e9"; // sky-500 -- matches the Head of Production panel accent
const MAINTENANCE_COLOR = "#8b5cf6"; // violet-500 -- matches the Head of Maintenance panel accent

export type AreaTrendPoint = {
  label: string;
  production: number | null;
  maintenance: number | null;
};

export function AreaTrendChart({ title, data }: { title: string; data: AreaTrendPoint[] }) {
  const hasAnyPoint = data.some((d) => d.production != null || d.maintenance != null);

  return (
    <div className="rounded-md border border-slate-200 p-2">
      <h5 className="text-xs font-semibold text-slate-700">{title}</h5>
      {!hasAnyPoint ? (
        <p className="mt-6 text-center text-xs text-slate-400">No scores in this range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 5, 10]}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={24}
            />
            <ReferenceLine y={CLEANING_LOW_SCORE_THRESHOLD} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="production"
              name="Production"
              stroke={PRODUCTION_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="maintenance"
              name="Maintenance"
              stroke={MAINTENANCE_COLOR}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
