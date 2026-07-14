import { prisma } from "@/lib/prisma";
import { ClaimForm } from "./claim-form";

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; containerNumber?: string }>;
}) {
  const { clientId, containerNumber } = await searchParams;
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">File Claim</h1>
      <div className="mt-6 max-w-4xl">
        <ClaimForm clients={clients} defaultClientId={clientId} defaultContainerNumber={containerNumber} />
      </div>
    </div>
  );
}
