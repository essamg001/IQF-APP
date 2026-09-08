import { prisma } from "@/lib/prisma";
import type { AlertType } from "@prisma/client";

// Where each alert type's relatedEntityId actually points -- used so clicking
// an alert goes straight to the record it's about instead of leaving the
// owner to search for it by hand. Most types build the href directly from
// the id; PALLET_AWAITING_RESHELVE is the one exception that needs a lookup,
// since its id is the PalletPullAside record, not the pallet itself.
export async function resolveAlertHrefs(
  alerts: { id: string; type: AlertType; relatedEntityId: string | null }[]
): Promise<Map<string, string>> {
  const hrefs = new Map<string, string>();

  const pullAsideIds = alerts
    .filter((a) => a.type === "PALLET_AWAITING_RESHELVE" && a.relatedEntityId)
    .map((a) => a.relatedEntityId!);
  const pullAsides = pullAsideIds.length
    ? await prisma.palletPullAside.findMany({ where: { id: { in: pullAsideIds } }, select: { id: true, palletId: true } })
    : [];
  const palletIdByPullAside = new Map(pullAsides.map((p) => [p.id, p.palletId]));

  for (const a of alerts) {
    const id = a.relatedEntityId;
    if (!id) continue;

    switch (a.type) {
      case "SPEC_MISMATCH":
      case "MICROBIOLOGY_LOAD_ATTEMPT":
      case "MRL_LOAD_ATTEMPT":
        hrefs.set(a.id, `/storage/${id}`);
        break;
      case "CONTAINER_OVERDUE":
      case "TEMPERATURE_EXCURSION":
        hrefs.set(a.id, `/logistics/${id}`);
        break;
      case "EARLY_WARNING":
        // Two distinct shapes share this type: a container id (transit
        // early-warning) or a "fieldId::metric,metric" composite (field
        // trend warning) -- see raiseFieldTrendAlert in alerts.ts.
        if (id.includes("::")) hrefs.set(a.id, "/fields");
        else hrefs.set(a.id, `/logistics/${id}`);
        break;
      case "QUALITY_LIMIT_EXCEEDED":
      case "QUALITY_OVERRIDE_APPROVED":
        hrefs.set(a.id, `/quality-check/${id}`);
        break;
      case "SHIFT_ON_HOLD":
        hrefs.set(a.id, `/shifts/${id}`);
        break;
      case "MICROBIOLOGY_REJECTED":
      case "SHIFT_MISSING_POST_DECAP_LINK":
        hrefs.set(a.id, `/production/${id}`);
        break;
      case "PALLET_AWAITING_RESHELVE": {
        const palletId = palletIdByPullAside.get(id);
        if (palletId) hrefs.set(a.id, `/storage/${palletId}`);
        break;
      }
      case "CERTIFICATION_EXPIRING":
        hrefs.set(a.id, "/certifications");
        break;
      case "GLOBALGAP_EXPIRING":
        hrefs.set(a.id, "/settings");
        break;
      case "PACKAGING_LOW_STOCK":
        hrefs.set(a.id, "/packaging-materials");
        break;
      case "WAREHOUSE_STOCK_LOW":
        hrefs.set(a.id, "/warehouse-stock");
        break;
      case "SCALE_OUT_OF_TOLERANCE":
        hrefs.set(a.id, "/scale-calibration");
        break;
      case "CHLORINE_DOSING_OUT_OF_TOLERANCE":
        hrefs.set(a.id, "/equipment-verification");
        break;
      case "RODENT_DETECTED":
        hrefs.set(a.id, "/pest-control");
        break;
      case "TOOL_INVENTORY_DISCREPANCY":
        hrefs.set(a.id, "/tool-inventory");
        break;
      case "BLADE_KNIFE_MISMATCH":
      case "BLADE_KNIFE_DAMAGED":
        hrefs.set(a.id, "/blade-control");
        break;
      case "SPRAY_RESTRICTION_BLOCKED":
        hrefs.set(a.id, "/fields");
        break;
      case "MICROBIOLOGY_PENDING":
        hrefs.set(a.id, "/lab");
        break;
      case "LOW_STOCK":
        hrefs.set(a.id, "/storage");
        break;
      case "ORDER_ALLOCATION_OVERDUE":
        hrefs.set(a.id, `/orders/${id}`);
        break;
      case "PURCHASE_REQUEST_OVERDUE":
        hrefs.set(a.id, `/purchase-requests/${id}`);
        break;
      // No default: an alert type with no known destination stays unlinked
      // rather than pointing somewhere wrong.
    }
  }

  return hrefs;
}
