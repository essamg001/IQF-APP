"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Role, Station } from "@prisma/client";

const NAV_ITEMS: { href: string; label: string; roles?: Role[]; requiresHeadOfSales?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/orders", label: "Orders" },
  { href: "/available-to-sell", label: "Available to Sell" },
  { href: "/logistics", label: "Logistics" },
  { href: "/production", label: "Production" },
  { href: "/storage", label: "Storage" },
  { href: "/quality", label: "Quality" },
  { href: "/claims", label: "Claims" },
  { href: "/waste", label: "Waste" },
  { href: "/shifts", label: "Hours Worked" },
  { href: "/trends", label: "Historical Trends", requiresHeadOfSales: true },
  { href: "/alerts", label: "Alerts" },
  { href: "/settings", label: "Setup" },
];

// A single-purpose entry point for a station-locked user — proxy.ts already
// bounces them off any other route, this just keeps the sidebar honest.
const STATION_ITEM: Record<Station, { href: string; label: string }> = {
  ARRIVAL_INSPECTION: { href: "/arrival-inspection", label: "Arrival Inspection" },
  POST_FREEZE_INSPECTION: { href: "/post-freeze-inspection", label: "Post-Freeze Inspection" },
  LOAD_OUT: { href: "/logistics", label: "Load-Out" },
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
