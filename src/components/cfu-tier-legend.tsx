import { CFU_TIERS, CFU_REJECT_TIER } from "@/lib/cfuTier";

// Shared legend for the cfu/g severity ramp -- every surface that colors
// something by cfu tier (storage map, storage list, production list) shows
// this alongside it, so the color is never the only way to read the tier.
// The 10 graduated tiers' labels are just numbers + the "cfu/g" unit, which
// read fine untranslated (same as "pH" elsewhere in the app) -- only the
// heading and the reject tier's "REJECT" word need locale-aware text, passed
// in by the caller from the i18n dict.
export function CfuTierLegend({
  className,
  title,
  rejectWord,
}: {
  className?: string;
  title: string;
  rejectWord: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 ${className ?? ""}`}>
      <span className="font-medium text-slate-600">{title}</span>
      {CFU_TIERS.map((tier) => (
        <span key={tier.label} className="inline-flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm ${tier.bg} border border-black/5`} />
          {tier.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className={`h-2.5 w-2.5 rounded-sm ${CFU_REJECT_TIER.bg}`} />
        {`> 100,000 cfu/g — ${rejectWord}`}
      </span>
    </div>
  );
}
