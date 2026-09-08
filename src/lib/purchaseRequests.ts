import type { PurchaseRequestStatus } from "@prisma/client";
import {
  canApproveAccounting,
  canCheckWarehouseStock,
  canManagePurchasing,
  canSignAsHeadOfProduction,
} from "@/lib/roles";

type ActionUser = Parameters<typeof canApproveAccounting>[0] &
  Parameters<typeof canCheckWarehouseStock>[0] &
  Parameters<typeof canManagePurchasing>[0] &
  Parameters<typeof canSignAsHeadOfProduction>[0];

/**
 * Whether this specific request is genuinely sitting and waiting on this
 * specific viewer right now -- the same status+role combinations
 * purchase-requests/[id]/page.tsx already uses to decide which action card
 * to render, pulled out so the list page's "Requires My Action" filter and
 * the overdue-alert sweep both agree with what the detail page actually
 * shows, instead of three separate copies of this logic drifting apart.
 */
export function isPurchaseRequestMyTurn(
  request: { status: PurchaseRequestStatus },
  user: ActionUser | undefined | null
): boolean {
  if (!user) return false;
  switch (request.status) {
    case "REQUESTED":
      return canCheckWarehouseStock(user);
    case "FORWARDED_TO_ACCOUNTING":
      return canApproveAccounting(user);
    case "APPROVED":
      // Covers both the "acknowledge receipt" and "mark as ordered" steps --
      // both are Purchasing's, whether or not they've acknowledged yet.
      return canManagePurchasing(user);
    case "ORDERED":
      // Production confirms receipt; Purchasing can still record a delay --
      // both cards are live at once on the detail page.
      return canSignAsHeadOfProduction(user) || canManagePurchasing(user);
    case "FULFILLED_FROM_WAREHOUSE":
      return canSignAsHeadOfProduction(user);
    case "RECEIVED":
      // confirmWorkingAction has no role gate -- any logged-in user can do this.
      return true;
    // REJECTED and CONFIRMED_WORKING are terminal -- nothing left to act on.
    default:
      return false;
  }
}
