import type { MrlStatus } from "@prisma/client";

type MrlResultLike = { status: MrlStatus } | null | undefined;

/** True once a lot's MRL (pesticide residue) test has come back Approved -- clear to load. */
export function isMrlCleared(result: MrlResultLike): boolean {
  return result?.status === "APPROVED";
}
