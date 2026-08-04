import { CFU_TIERS, CFU_REJECT_TIER } from "@/lib/cfuTier";

// Shared legend for the cfu/g severity ramp -- every surface that colors
// something by cfu tier (storage map, storage list, production list) shows
// this alongside it, so the color is never the only way to read the tier.
export function CfuTierLegend({ className }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 ${className ?? ""}`}>
      <span className="font-medium text-slate-600">Total Plate Count:</span>
      {[...CFU_TIERS, CFU_REJECT_TIER].map((tier) => (
        <span key={tier.label} className="inline-flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm ${tier.bg} ${tier.bg === "bg-black" ? "" : "border border-black/5"}`} />
          {tier.label}
        </span>
      ))}
    </div>
  );
}
