import { cn } from "@/lib/cn";

// Marks a record created purely to exercise a feature during development
// (see e.g. ProductionLot.isTestData) so it's never mistaken for real
// production/commercial data while it's still in the database.
export function TestDataBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold italic text-red-700 bg-red-50 border border-red-200",
        className
      )}
    >
      TEST DATA
    </span>
  );
}

// Applied directly to an identifier's own text (pallet/lot number, spec
// name, certificate number) alongside the badge above, per the owner's
// request to make test data visually unmistakable at a glance.
export const TEST_DATA_TEXT_CLASS = "italic text-red-700";
