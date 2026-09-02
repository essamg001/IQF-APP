"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import type { Role, Station } from "@prisma/client";

type NavKey = keyof Dictionary["nav"];

type NavItem = { href: string; labelKey: NavKey; roles?: Role[]; requiresHeadOfSales?: boolean; requiresHeadOfProduction?: boolean };

// Two different kinds of section, deliberately kept apart: sections whose
// items follow the strawberry's own physical journey (harvest -> decap ->
// freeze -> pack -> store -> sell -> ship), in that order, vs. sections of
// recurring checks/logs that run alongside the pipeline rather than as a
// step within it (a cleaning log or a scale calibration isn't "between"
// Final Product Entry and Storage, so it shouldn't visually sit between
// them either). headerKey is omitted for the top cluster -- Dashboard,
// Alerts, and Our Process read fine as unlabeled top-level items.
const NAV_SECTIONS: { headerKey?: NavKey; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", labelKey: "dashboard" },
      { href: "/alerts", labelKey: "alerts" },
      { href: "/our-process", labelKey: "ourProcess" },
    ],
  },
  {
    // Pure reference/documentation content -- not a log, not a data table --
    // so it lives apart from sectionCompliance (recurring logs).
    headerKey: "sectionProtocolsReference",
    items: [
      { href: "/crop-protection-plan", labelKey: "cropProtectionPlan", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/haccp-flow-diagram", labelKey: "haccpFlowDiagram", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/haccp-hazard-analysis", labelKey: "haccpHazardAnalysis", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/emergency-protocols", labelKey: "emergencyProtocols" },
      { href: "/supervisor-roles", labelKey: "supervisorRoles" },
      { href: "/org-structure", labelKey: "orgStructure" },
    ],
  },
  {
    // The product's own journey, in physical order.
    headerKey: "sectionPipeline",
    items: [
      { href: "/fields", labelKey: "fields" },
      { href: "/harvest-tickets", labelKey: "harvestTickets", roles: ["OWNER", "QUALITY"] },
      { href: "/field-spray-log", labelKey: "fieldSprayLog", roles: ["OWNER", "QUALITY"] },
      { href: "/pre-decap-inspection", labelKey: "preDecapArrivals", roles: ["OWNER", "QUALITY"] },
      { href: "/post-decap-quality", labelKey: "postDecapQuality", roles: ["OWNER", "QUALITY"] },
      { href: "/field-quality", labelKey: "fieldQuality", roles: ["OWNER", "QUALITY"] },
      { href: "/yield-recovery", labelKey: "yieldRecovery", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/arrival-inspection", labelKey: "arrivalInspection", roles: ["OWNER", "QUALITY"] },
      { href: "/shifts", labelKey: "shifts" },
      { href: "/production", labelKey: "production" },
      { href: "/post-freeze-inspection", labelKey: "postFreezeInspection", roles: ["OWNER", "QUALITY"] },
      { href: "/final-product-entry", labelKey: "finalProductEntry", roles: ["OWNER", "PRODUCTION"] },
      { href: "/storage", labelKey: "storage" },
      { href: "/lab", labelKey: "lab", roles: ["OWNER", "QUALITY"] },
    ],
  },
  {
    headerKey: "sectionSalesShipping",
    items: [
      { href: "/clients", labelKey: "clients" },
      { href: "/orders", labelKey: "orders" },
      { href: "/active-orders", labelKey: "activeOrders" },
      { href: "/available-to-sell", labelKey: "availableToSell" },
      { href: "/trends", labelKey: "historicalTrends", requiresHeadOfSales: true },
      { href: "/financials", labelKey: "financials", requiresHeadOfSales: true },
      { href: "/logistics", labelKey: "logistics" },
    ],
  },
  {
    // Recurring checks and logs that run alongside the pipeline, not a step
    // within it -- ordered as a group, not chronologically against the
    // pipeline above.
    headerKey: "sectionCompliance",
    items: [
      { href: "/waste", labelKey: "waste" },
      { href: "/daily-report", labelKey: "dailyReport", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/cleaning", labelKey: "cleaningMode" },
      { href: "/cleaning-schedule", labelKey: "cleaningSchedule" },
      { href: "/cleaning-materials-log", labelKey: "cleaningMaterialsLog" },
      { href: "/daily-checklist", labelKey: "dailyChecklist" },
      { href: "/equipment-verification", labelKey: "equipmentVerification", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/scale-calibration", labelKey: "scaleCalibration" },
      { href: "/tool-inventory", labelKey: "toolInventory" },
      { href: "/pest-control", labelKey: "pestControl" },
      { href: "/forklift-condition", labelKey: "forkliftCondition" },
      { href: "/blade-control", labelKey: "bladeControl" },
      { href: "/personal-items", labelKey: "personalItems" },
      { href: "/injury-log", labelKey: "injuryLog" },
      { href: "/structural-issues", labelKey: "structuralIssues" },
      { href: "/packaging-materials", labelKey: "packagingMaterials" },
      { href: "/visits", labelKey: "visits", requiresHeadOfProduction: true },
      { href: "/non-conformance", labelKey: "nonConformance" },
      { href: "/laundry", labelKey: "laundry", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/training", labelKey: "staffTraining", roles: ["OWNER", "QUALITY", "PRODUCTION"] },
      { href: "/certifications", labelKey: "certifications", roles: ["OWNER", "QUALITY"] },
      { href: "/purchase-requests", labelKey: "purchaseRequests" },
    ],
  },
  {
    headerKey: "sectionQualityPostShipment",
    items: [
      { href: "/quality", labelKey: "quality" },
      { href: "/quality-issues", labelKey: "qualityIssues" },
      { href: "/traceability", labelKey: "traceability", roles: ["OWNER", "QUALITY"] },
      { href: "/claims", labelKey: "claims" },
    ],
  },
  {
    headerKey: "sectionSystem",
    items: [
      { href: "/activity-log", labelKey: "activityLog", roles: ["OWNER"] },
      { href: "/settings", labelKey: "settings" },
    ],
  },
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

export function Nav({
  role,
  isHeadOfSales,
  isHeadOfProduction,
  station,
}: {
  role: Role;
  isHeadOfSales: boolean;
  isHeadOfProduction: boolean;
  station: Station | null;
}) {
  const pathname = usePathname();
  const dict = useTranslations();
  const canSeeTrends = role === "OWNER" || isHeadOfSales;
  const canSeeVisits = role === "OWNER" || isHeadOfProduction;

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
      {NAV_SECTIONS.map((section, sectionIndex) => {
        const visibleItems = section.items
          .filter((item) => !item.roles || item.roles.includes(role))
          .filter((item) => !item.requiresHeadOfSales || canSeeTrends)
          .filter((item) => !item.requiresHeadOfProduction || canSeeVisits);
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.headerKey ?? `top-${sectionIndex}`} className={sectionIndex > 0 ? "pt-3" : undefined}>
            {section.headerKey && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {dict.nav[section.headerKey]}
              </p>
            )}
            {visibleItems.map((item) => {
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
          </div>
        );
      })}
    </nav>
  );
}
