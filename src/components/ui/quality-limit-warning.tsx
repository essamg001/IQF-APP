import type { LimitViolation } from "@/lib/qualityLimits";
import { formatViolation } from "@/lib/qualityLimits";

export function QualityLimitWarning({ violations }: { violations: LimitViolation[] }) {
  if (violations.length === 0) return null;
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3">
      <p className="text-sm font-semibold text-red-800">
        ⚠ Out of spec — do not move this produce into storage or load-out until reviewed:
      </p>
      <ul className="mt-1 list-inside list-disc text-sm text-red-700">
        {violations.map((v) => (
          <li key={v.label}>{formatViolation(v)}</li>
        ))}
      </ul>
    </div>
  );
}
