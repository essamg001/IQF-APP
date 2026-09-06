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

// Every step through Loaded is derived automatically; only these two are
// still a real person confirming a real-world fact nothing else can prove
// (Shipped auto-advances the instant every allocated pallet actually
// ships, so it isn't "manual" in this sense even though a human eventually
// caused it). Marked with a dashed ring so it's visually obvious, before
// ever reading a label, which steps in this row need someone's action.
const MANUAL_KEYS: LifecycleStepKey[] = ["DELIVERED", "PAID"];

// Escalates the banner's tone with how urgent the active blocker actually
// is (see getOrderLifecycleStatus's aging calculation) -- a fresh order
// waiting on stock reads very differently from one that's been stuck for
// two weeks with a ship date already blown past, and this used to look
// identical either way.
const BANNER_CLASS: Record<NonNullable<LifecycleStep["urgency"]> | "default", string> = {
  critical: "border-red-300 bg-red-50 text-red-800",
  warning: "border-orange-200 bg-orange-50 text-orange-800",
  normal: "border-amber-200 bg-amber-50 text-amber-800",
  default: "border-emerald-200 bg-emerald-50 text-emerald-800",
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
  manualStepTitle,
}: {
  steps: LifecycleStep[];
  labels: Record<LifecycleStepKey, string>;
  actions?: Partial<Record<LifecycleStepKey, React.ReactNode>>;
  /** Native-tooltip text for the dashed manual-step marker, e.g. "Requires manual confirmation". */
  manualStepTitle?: string;
}) {
  const active = findActiveStep(steps);

  return (
    <div>
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                title={MANUAL_KEYS.includes(step.key) && step.status !== "done" ? manualStepTitle : undefined}
                className={cn(
                  "h-3.5 w-3.5 rounded-full border-2",
                  DOT_CLASS[step.status],
                  step === active && "ring-4 ring-amber-100",
                  MANUAL_KEYS.includes(step.key) && step.status !== "done" && "border-dashed"
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
            active.status === "blocked" ? BANNER_CLASS[active.urgency ?? "normal"] : BANNER_CLASS.default
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
