"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const GROSS_COLOR = "#2a78d6";
const NET_COLOR = "#1baf7a";

export function GrossNetChart({ data }: { data: { year: string; gross: number; net: number }[] }) {
  const format = (v: number | string | undefined) => `$${Number(v ?? 0).toLocaleString()}`;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis dataKey="year" tick={{ fill: "#898781", fontSize: 12 }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <YAxis tick={{ fill: "#898781", fontSize: 12 }} axisLine={false} tickLine={false} width={70} />
        <Tooltip
          formatter={(v) => format(v as number)}
          contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="gross" name="Gross" fill={GROSS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="net" name="Net (after claims)" fill={NET_COLOR} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
