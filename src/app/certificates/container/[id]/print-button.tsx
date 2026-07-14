"use client";

export function PrintButton() {
  return (
    <button className="toolbar-print-btn" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
