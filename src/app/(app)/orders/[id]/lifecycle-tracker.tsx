import Link from "next/link";
import { cn } from "@/lib/cn";
import type { LifecycleStep, LifecycleStepKey } from "@/lib/orderLifecycle";

const DOT_CLASS: Record<LifecycleStep["status"], string> = {
  done: "bg-emerald-600 border-emerald-600",
  current: "bg-white border-emerald-600",
  blocked: "bg-white border-amber-500",
  upcoming: "bg-white border-slate-300",
};

const LABEL_CLASS: Record<LifecycleStep["status"], string> = {
  done: "text-slate-700",
  current: "text-emerald-700 font-medium",
  blocked: "text-amber-700 font-medium",
  upcoming: "text-slate-400",
};

// The tracker only ever surfaces ONE callout -- the earliest step in
// sequence that isn't done yet -- since that's the real bottleneck; a later
// step's own status (e.g. Lab Cleared showing "blocked" on pallets that
// haven't even been allocated) isn't actionable until the earlier gap closes.
function findActiveStep(steps: LifecycleStep[]): LifecycleStep | undefined {
  return steps.find((s) => s.status === "blocked" || s.status === "current");
}

export function LifecycleTracker({
  steps,
  labels,
  actions,
}: {
  steps: LifecycleStep[];
  labels: Record<LifecycleStepKey, string>;
  actions?: Partial<Record<LifecycleStepKey, React.ReactNode>>;
}) {
  const active = findActiveStep(steps);

  return (
    <div>
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2",
                  DOT_CLASS[step.status],
                  step === active && "ring-4 ring-amber-100"
                )}
              />
              <span className={cn("whitespace-nowrap text-xs", LABEL_CLASS[step.status])}>{labels[step.key]}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-1.5 h-0.5 flex-1", step.status === "done" ? "bg-emerald-600" : "bg-slate-200")} />
            )}
          </div>
        ))}
      </div>

      {active?.detail && (
        <div
          className={cn(
            "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
            active.status === "blocked" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
        >
          <span>{active.detail}</span>
          <div className="flex items-center gap-2">
            {active.actionHref && (
              <Link href={active.actionHref} className="text-sm font-medium underline hover:no-underline">
                {active.actionLabel ?? "View"}
              </Link>
            )}
            {actions?.[active.key]}
          </div>
        </div>
      )}
    </div>
  );
}
