import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  SALES: "Sales",
  QUALITY: "Quality",
  PRODUCTION: "Production",
  LOGISTICS: "Logistics",
};

export const ROLES_WITH_PRICING_ACCESS: Role[] = ["OWNER", "SALES"];

export function canSeePricing(role: Role | undefined | null) {
  return !!role && ROLES_WITH_PRICING_ACCESS.includes(role);
}

/**
 * Historical/trend financials (lifetime + annual value per client) are more
 * sensitive than order-level pricing, so access is deliberately narrower:
 * the Owner plus whoever is flagged as head of sales — not the whole Sales role.
 */
export function canSeeHistoricalTrends(user: { role: Role; isHeadOfSales: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfSales;
}
