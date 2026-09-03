import { cn } from "@/lib/cn";

type Stage = "dispatch" | "atLab" | "resolved";
const ORDER: Stage[] = ["dispatch", "atLab", "resolved"];

// Same dot/connector visual language as the Order lifecycle tracker
// (orders/[id]/lifecycle-tracker.tsx), scaled down to this fixed 3-step
// pipeline -- makes it visually obvious, wherever you are in a lab result,
// which of Awaiting Dispatch / Sent to Lab / Resolved you're acting on,
// and that changing Status (not just attaching a certificate) is what
// advances it.
export function LabPipelineTracker({ current, labels }: { current: Stage; labels: [string, string, string] }) {
  const currentIndex = ORDER.indexOf(current);

  return (
    <div className="mb-3 flex items-center">
      {ORDER.map((stage, i) => (
        <div key={stage} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "h-3 w-3 rounded-full border-2",
                i < currentIndex
                  ? "border-emerald-600 bg-emerald-600"
                  : i === currentIndex
                    ? "border-emerald-600 bg-white ring-4 ring-emerald-100"
                    : "border-slate-300 bg-white"
              )}
            />
            <span
              className={cn(
                "whitespace-nowrap text-xs",
                i === currentIndex ? "font-medium text-emerald-700" : i < currentIndex ? "text-slate-700" : "text-slate-400"
              )}
            >
              {labels[i]}
            </span>
          </div>
          {i < ORDER.length - 1 && (
            <div className={cn("mx-1.5 h-0.5 flex-1", i < currentIndex ? "bg-emerald-600" : "bg-slate-200")} />
          )}
        </div>
      ))}
    </div>
  );
}
