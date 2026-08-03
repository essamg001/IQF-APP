"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Role, Station } from "@prisma/client";

const NAV_ITEMS: { href: string; label: string; roles?: Role[]; requiresHeadOfSales?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/fields", label: "Fields" },
  { href: "/field-quality", label: "Field Quality", roles: ["OWNER", "QUALITY"] },
  { href: "/traceability", label: "Traceability / Recall Lookup", roles: ["OWNER", "QUALITY"] },
  { href: "/grower-scorecard", label: "Harvest Report", roles: ["OWNER", "QUALITY"] },
  { href: "/clients", label: "Clients" },
  { href: "/orders", label: "Orders" },
  { href: "/active-orders", label: "Active Orders" },
  { href: "/available-to-sell", label: "Available to Sell" },
  { href: "/trends", label: "Historical Trends", requiresHeadOfSales: true },
  { href: "/costing", label: "Costing", requiresHeadOfSales: true },
  { href: "/harvest-tickets", label: "Harvest Tickets", roles: ["OWNER", "QUALITY"] },
  { href: "/pre-decap-inspection", label: "Decap: Pre-Decap Arrivals", roles: ["OWNER", "QUALITY"] },
  { href: "/post-decap-quality", label: "Decap: Post-Decap Quality", roles: ["OWNER", "QUALITY"] },
  { href: "/arrival-inspection", label: "Arrival Inspection at Factory", roles: ["OWNER", "QUALITY"] },
  { href: "/production", label: "Production" },
  { href: "/post-freeze-inspection", label: "Post-Freeze Inspection", roles: ["OWNER", "QUALITY"] },
  { href: "/final-product-entry", label: "Final Product Entry", roles: ["OWNER", "PRODUCTION"] },
  { href: "/waste", label: "Waste" },
  { href: "/storage", label: "Storage" },
  { href: "/shifts", label: "Hours Worked" },
  { href: "/quality", label: "Quality" },
  { href: "/lab", label: "Lab", roles: ["OWNER", "QUALITY"] },
  { href: "/load-out", label: "Load Out" },
  { href: "/logistics", label: "Logistics" },
  { href: "/claims", label: "Claims" },
  { href: "/quality-issues", label: "Quality Issues" },
  { href: "/alerts", label: "Alerts" },
  { href: "/activity-log", label: "Activity Log", roles: ["OWNER"] },
  { href: "/settings", label: "Setup" },
];

// A single-purpose entry point for a station-locked user — proxy.ts already
// bounces them off any other route, this just keeps the sidebar honest.
const STATION_ITEM: Record<Station, { href: string; label: string }> = {
  ARRIVAL_INSPECTION: { href: "/arrival-inspection", label: "Arrival Inspection at Factory" },
  POST_FREEZE_INSPECTION: { href: "/post-freeze-inspection", label: "Post-Freeze Inspection" },
  LOAD_OUT: { href: "/logistics", label: "Load-Out" },
  FINAL_PRODUCT_ENTRY: { href: "/final-product-entry", label: "Final Product Entry" },
  LAB: { href: "/lab", label: "Lab" },
};

export function Nav({ role, isHeadOfSales, station }: { role: Role; isHeadOfSales: boolean; station: Station | null }) {
  const pathname = usePathname();
  const canSeeTrends = role === "OWNER" || isHeadOfSales;

  if (station) {
    const item = STATION_ITEM[station];
    return (
      <nav className="space-y-1">
        <span className="block rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">{item.label}</span>
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))
        .filter((item) => !item.requiresHeadOfSales || canSeeTrends)
        .map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm font-medium",
              active ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
