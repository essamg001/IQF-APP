"use client";

import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import { cn } from "@/lib/cn";

/**
 * Triggers the browser's native print dialog, which on every platform this
 * app runs on offers "Save as PDF" -- no server-side rendering or new
 * dependency needed. Pair with .no-print / .print-only utility classes (see
 * globals.css) on the page to control what actually ends up in the PDF.
 */
export function PrintButton({ className }: { className?: string }) {
  const dict = useTranslations();
  return (
    <Button type="button" variant="secondary" className={cn("no-print", className)} onClick={() => window.print()}>
      {dict.common.downloadPdf}
    </Button>
  );
}
