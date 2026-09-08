import { Card } from "@/components/ui/card";

type ArrivalCheck = { shiftType: string | null; numberOfBoxesReceived: number | null };

export function ArrivalPalletsSection({
  factoryName,
  checks,
  title,
  dayLabel,
  nightLabel,
}: {
  factoryName: string;
  checks: ArrivalCheck[];
  title: string;
  dayLabel: string;
  nightLabel: string;
}) {
  const sum = (shiftType: "DAY" | "NIGHT") =>
    checks.filter((c) => c.shiftType === shiftType).reduce((s, c) => s + (c.numberOfBoxesReceived ?? 0), 0);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-slate-900">{title.replace("{factory}", factoryName)}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-xs text-slate-500">{dayLabel}</p>
          <p className="text-lg font-semibold text-slate-900">{sum("DAY")}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">{nightLabel}</p>
          <p className="text-lg font-semibold text-slate-900">{sum("NIGHT")}</p>
        </div>
      </div>
    </Card>
  );
}
