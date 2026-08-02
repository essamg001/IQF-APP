import { prisma } from "@/lib/prisma";

/**
 * Records who did what, when -- deliberately fire-and-forget (never blocks or
 * fails the calling action) since a logging hiccup should never stop the real
 * operation from completing.
 */
export async function logActivity(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  detail?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: params.actorId ?? undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        detail: params.detail,
      },
    });
  } catch {
    // Logging failures must never break the underlying action.
  }
}
