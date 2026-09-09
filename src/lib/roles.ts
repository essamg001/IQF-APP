import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  SALES: "Sales",
  QUALITY: "Quality",
  PRODUCTION: "Production",
  LOGISTICS: "Logistics",
  MAINTENANCE: "Maintenance",
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
export function canSeeHistoricalTrends(
  user: { role: Role; isHeadOfSales: boolean; financialsRestricted: boolean } | undefined | null
) {
  if (!user) return false;
  if (user.financialsRestricted) return false;
  return user.role === "OWNER" || user.isHeadOfSales;
}

/**
 * The standalone Financials page (order value, container value/costs) is
 * more sensitive than general order-level pricing -- whoever is physically
 * running load-out or a regular Sales rep shouldn't be able to see what a
 * shipment is worth, so this is deliberately narrower than canSeePricing:
 * Owner + Head of Sales/Export only, not the whole Sales role. Order value
 * itself used to be visible inline (via canSeePricing) on Orders/Dashboard/
 * Active Orders -- it now lives only behind this gate, on /financials.
 */
export function canSeeFinancials(
  user: { role: Role; isHeadOfSales: boolean; financialsRestricted: boolean } | undefined | null
) {
  if (!user) return false;
  if (user.financialsRestricted) return false;
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
 * Cleaning Mode's Head of Production side (scoring + sign-off) -- same
 * narrow-accountability reasoning as canSignSpecException, kept as its own
 * function since the two features are unrelated even though the check is
 * identical today.
 */
export function canSignAsHeadOfProduction(user: { role: Role; isHeadOfProduction: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfProduction;
}

/**
 * Visits (client audits/factory visits) -- Owner + whoever holds
 * isHeadOfProduction, since the owner said Head of Production will most
 * likely be the one actually recording this data day-to-day.
 */
export function canAccessVisits(user: { role: Role; isHeadOfProduction: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfProduction;
}

/** Cleaning Mode's Head of Maintenance side -- see canSignAsHeadOfProduction. */
export function canSignAsHeadOfMaintenance(user: { role: Role; isHeadOfMaintenance: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfMaintenance;
}

/**
 * Approving, ordering, and tracking delivery on a Purchase Request -- same
 * narrow-accountability reasoning as canSignAsHeadOfProduction/Maintenance.
 * Not tied to a Role since there's no dedicated "Purchasing" role either.
 */
export function canManagePurchasing(user: { role: Role; isHeadOfPurchasing: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfPurchasing;
}

/**
 * Submitting a purchase request -- Head of Production or Head of
 * Maintenance specifically (the two teams the owner named), not the whole
 * Production role. No dedicated "Maintenance" role exists at all, only this
 * flag on whoever holds that responsibility.
 */
export function canSubmitPurchaseRequest(
  user: { role: Role; isHeadOfProduction: boolean; isHeadOfMaintenance: boolean } | undefined | null
) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfProduction || user.isHeadOfMaintenance;
}

/**
 * Checking on-site warehouse stock before a purchase request is forwarded
 * to Purchasing -- a distinct real-world role from Head of Purchasing
 * (matches the real Release Order form's own "Store Supervisor" signature
 * line). No dedicated "Warehouse" role exists either.
 */
export function canCheckWarehouseStock(user: { role: Role; isStoreSupervisor: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isStoreSupervisor;
}

/**
 * Accounting's final sign-off on a purchase request, required in addition
 * to (not instead of) Purchasing's own approval -- same narrow-
 * accountability reasoning as every other isHeadOf* gate. No dedicated
 * "Accounting" role exists either.
 */
export function canApproveAccounting(user: { role: Role; isHeadOfAccounting: boolean } | undefined | null) {
  if (!user) return false;
  return user.role === "OWNER" || user.isHeadOfAccounting;
}

/**
 * Client records carry commercial terms and specs (including the CFU limit
 * that hard-gates allocation/load-out) -- Sales owns these relationships, so
 * access matches canSeePricing rather than being open to every role.
 */
export function canManageClients(role: Role | undefined | null) {
  return !!role && ROLES_WITH_PRICING_ACCESS.includes(role);
}

/**
 * The Lab page's own actions are the hard gate the rest of the app trusts
 * (they flip microbiology/MRL results to APPROVED/FAILED and release shift
 * holds) -- matches the role check /lab's page-level redirect already uses,
 * applied at the action layer too since a page redirect alone doesn't stop a
 * Server Action from being invoked directly.
 */
export function canAccessLab(role: Role | undefined | null) {
  return !!role && (role === "OWNER" || role === "QUALITY");
}
