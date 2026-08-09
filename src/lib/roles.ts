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

/**
 * Container value (price/kg, price/carton, computed shipment value, payment
 * terms) in Logistics is more sensitive than general order-level pricing --
 * whoever is physically running load-out shouldn't be able to see what a
 * shipment is worth, so this is deliberately narrower than canSeePricing:
 * Owner + Head of Sales/Export only, not the whole Sales role.
 */
export function canSeeContainerValue(user: { role: Role; isHeadOfSales: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfSales;
}

/**
 * Margin/costing figures (raw material, labor, packaging cost vs. revenue)
 * are the most sensitive financial data in the app -- same narrow rule as
 * container value and historical trends: Owner + Head of Sales/Export only.
 */
export function canSeeCosting(user: { role: Role; isHeadOfSales: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfSales;
}

/**
 * Signing off loading a pallet that fails a client's own spec (see
 * SpecException) is deliberately narrow -- Owner + whoever holds
 * isHeadOfProduction only, never the whole Production role -- since the
 * point of the sign-off is a permanent record the owner can hold one
 * specific person accountable against.
 */
export function canSignSpecException(user: { role: Role; isHeadOfProduction: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfProduction;
}

/**
 * Client records carry commercial terms and specs (including the CFU limit
 * that hard-gates allocation/load-out) -- Sales owns these relationships, so
 * access matches canSeePricing rather than being open to every role.
 */
export function canManageClients(role: Role | undefined | null) {
  return !!role && ROLES_WITH_PRICING_ACCESS.includes(role);
}
