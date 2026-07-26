"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeContainerCertificateData } from "@/lib/certificate";
import { revalidatePath } from "next/cache";

export async function approveCertificateAction(
  containerId: string,
  _prevState: string | undefined,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user || !["QUALITY", "OWNER"].includes(session.user.role)) {
    return "Only Quality or the Owner can approve a certificate.";
  }

  const approverName = String(formData.get("approverName") ?? "").trim();
  if (!approverName) return "Approver name is required.";

  const result = await computeContainerCertificateData(containerId);
  if (!result) return "Container not found.";
  if (!result.gate.ready) {
    return `Cannot approve yet: ${result.gate.reasons.join(" ")}`;
  }

  await prisma.container.update({
    where: { id: containerId },
    data: {
      certificateApprovedAt: new Date(),
      certificateApprovedByName: approverName,
      certificateSnapshot: JSON.parse(JSON.stringify(result.data)),
    },
  });

  revalidatePath(`/certificates/container/${containerId}`);
}
