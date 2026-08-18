"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "@/lib/i18n/locale-context";

const SERIES_BLUE = "#2a78d6";

export function YearlyChart({
  data,
  dataKey,
  unit,
}: {
  data: { year: string; value: number }[];
  dataKey: string;
  unit: "usd" | "pallets";
}) {
  const dict = useTranslations().trends;
  const format = (v: number | string | undefined) =>
    unit === "usd"
      ? `$${Number(v ?? 0).toLocaleString()}`
      : dict.formatPalletsValue.replace("{value}", String(v ?? 0));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#e1e0d9" />
        <XAxis dataKey="year" tick={{ fill: "#898781", fontSize: 12 }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
        <YAxis tick={{ fill: "#898781", fontSize: 12 }} axisLine={false} tickLine={false} width={60} />
        <Tooltip
          formatter={(v) => format(v as number)}
          contentStyle={{ borderRadius: 8, borderColor: "#e1e0d9", fontSize: 13 }}
        />
        <Bar dataKey={dataKey} fill={SERIES_BLUE} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
