"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Role, Station } from "@prisma/client";

type NavKey = keyof Dictionary["nav"];

const NAV_ITEMS: { href: string; labelKey: NavKey; roles?: Role[]; requiresHeadOfSales?: boolean }[] = [
  // Overview
  { href: "/", labelKey: "dashboard" },
  { href: "/our-process", labelKey: "ourProcess" },

  // Reference data
  { href: "/fields", labelKey: "fields" },
  { href: "/clients", labelKey: "clients" },

  // Field & Decap stage
  { href: "/harvest-tickets", labelKey: "harvestTickets", roles: ["OWNER", "QUALITY"] },
  { href: "/pre-decap-inspection", labelKey: "preDecapArrivals", roles: ["OWNER", "QUALITY"] },
  { href: "/post-decap-quality", labelKey: "postDecapQuality", roles: ["OWNER", "QUALITY"] },
  { href: "/field-quality", labelKey: "fieldQuality", roles: ["OWNER", "QUALITY"] },
  { href: "/yield-recovery", labelKey: "yieldRecovery", roles: ["OWNER", "QUALITY", "PRODUCTION"] },

  // Factory: intake -> freeze -> pack
  { href: "/arrival-inspection", labelKey: "arrivalInspection", roles: ["OWNER", "QUALITY"] },
  { href: "/shifts", labelKey: "shifts" },
  { href: "/production", labelKey: "production" },
  { href: "/post-freeze-inspection", labelKey: "postFreezeInspection", roles: ["OWNER", "QUALITY"] },
  { href: "/final-product-entry", labelKey: "finalProductEntry", roles: ["OWNER", "PRODUCTION"] },
  { href: "/waste", labelKey: "waste" },
  { href: "/daily-report", labelKey: "dailyReport", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
  { href: "/cleaning", labelKey: "cleaningMode" },
  { href: "/cleaning-schedule", labelKey: "cleaningSchedule" },
  { href: "/daily-checklist", labelKey: "dailyChecklist" },
  { href: "/equipment-verification", labelKey: "equipmentVerification", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
  { href: "/laundry", labelKey: "laundry", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
  { href: "/training", labelKey: "staffTraining", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
  { href: "/purchase-requests", labelKey: "purchaseRequests" },
  { href: "/structural-issues", labelKey: "structuralIssues" },
  { href: "/personal-items", labelKey: "personalItems" },
  { href: "/injury-log", labelKey: "injuryLog" },
  { href: "/blade-control", labelKey: "bladeControl" },
  { href: "/packaging-materials", labelKey: "packagingMaterials" },
  { href: "/forklift-condition", labelKey: "forkliftCondition" },
  { href: "/non-conformance", labelKey: "nonConformance" },

  // Storage & Lab (gates before a pallet can ship)
  { href: "/storage", labelKey: "storage" },
  { href: "/lab", labelKey: "lab", roles: ["OWNER", "QUALITY"] },

  // Sales
  { href: "/orders", labelKey: "orders" },
  { href: "/active-orders", labelKey: "activeOrders" },
  { href: "/available-to-sell", labelKey: "availableToSell" },

  // Shipping
  { href: "/load-out", labelKey: "loadOut" },
  { href: "/logistics", labelKey: "logistics" },

  // Sales reporting
  { href: "/trends", labelKey: "historicalTrends", requiresHeadOfSales: true },

  // Quality oversight & post-shipment issues
  { href: "/quality", labelKey: "quality" },
  { href: "/quality-issues", labelKey: "qualityIssues" },
  { href: "/traceability", labelKey: "traceability", roles: ["OWNER", "QUALITY"] },
  { href: "/claims", labelKey: "claims" },

  // System
  { href: "/alerts", labelKey: "alerts" },
  { href: "/activity-log", labelKey: "activityLog", roles: ["OWNER"] },
  { href: "/settings", labelKey: "settings" },
];

// A single-purpose entry point for a station-locked user — proxy.ts already
// bounces them off any other route, this just keeps the sidebar honest.
const STATION_ITEM: Record<Station, { href: string; labelKey: NavKey }> = {
  ARRIVAL_INSPECTION: { href: "/arrival-inspection", labelKey: "arrivalInspection" },
  POST_FREEZE_INSPECTION: { href: "/post-freeze-inspection", labelKey: "postFreezeInspection" },
  LOAD_OUT: { href: "/logistics", labelKey: "loadOut" },
  FINAL_PRODUCT_ENTRY: { href: "/final-product-entry", labelKey: "finalProductEntry" },
  LAB: { href: "/lab", labelKey: "lab" },
};

export function Nav({ role, isHeadOfSales, station }: { role: Role; isHeadOfSales: boolean; station: Station | null }) {
  const pathname = usePathname();
  const dict = useTranslations();
  const canSeeTrends = role === "OWNER" || isHeadOfSales;

  if (station) {
    const item = STATION_ITEM[station];
    return (
      <nav className="space-y-1">
        <span className="block rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white">
          {dict.nav[item.labelKey]}
        </span>
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
            {dict.nav[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}
