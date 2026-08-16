import { cn } from "@/lib/cn";
import type { MrlStatus } from "@prisma/client";

// MRL (pesticide residue) is an equally hard gate as microbiology/CFU at
// load-out and on the certificate (see src/lib/mrl.ts), but wasn't shown
// anywhere on the storage surfaces where microbiology/CFU already are --
// this closes that gap with the same badge treatment.
const STATUS_STYLE: Record<MrlStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-slate-100", text: "text-slate-700", label: "Pending" },
  SENT_TO_LAB: { bg: "bg-blue-100", text: "text-blue-800", label: "Sent to lab" },
  APPROVED: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Approved" },
  FAILED: { bg: "bg-red-100", text: "text-red-800", label: "Failed" },
};

export function MrlStatusBadge({ status, className }: { status: MrlStatus; className?: string }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", style.bg, style.text, className)}
    >
      MRL: {style.label}
    </span>
  );
}
