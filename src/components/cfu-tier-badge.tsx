import { cn } from "@/lib/cn";
import { cfuTierFor, type CfuTier } from "@/lib/cfuTier";

// Renders a cfu/g severity tier as a colored badge with its numeric label --
// used everywhere a pallet's microbiology tier needs to show (storage list,
// pallet detail, storage map, production list, certificate), so all of them
// draw from the same src/lib/cfuTier.ts source instead of separately
// hand-maintained color maps.
export function CfuTierBadge({ cfuValue, className }: { cfuValue: number | null; className?: string }) {
  if (cfuValue == null) {
    return <span className={cn("text-xs text-slate-400", className)}>—</span>;
  }
  const tier: CfuTier = cfuTierFor(cfuValue);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tier.bg,
        tier.text,
        className
      )}
      title={tier.label}
    >
      {cfuValue.toLocaleString("en-US")} cfu/g
    </span>
  );
}
