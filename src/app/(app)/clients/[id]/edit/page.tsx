import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canManageClients } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";
import { ClientForm } from "../../client-form";
import { updateClientAction } from "../../actions";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, client] = await Promise.all([
    auth(),
    prisma.client.findUnique({ where: { id }, include: { specs: true } }),
  ]);
  if (!client) notFound();
  if (!canManageClients(session?.user.role)) redirect(`/clients/${id}`);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Edit {client.name}</h1>
      <div className="mt-6 max-w-4xl">
        <ClientForm
          action={updateClientAction.bind(null, client.id)}
          submitLabel="Save changes"
          initial={{
            name: client.name,
            country: client.country,
            contactName: client.contactName,
            contactEmail: client.contactEmail,
            contactPhone: client.contactPhone,
            paymentTerms: client.paymentTerms,
            incoterms: client.incoterms,
            currency: client.currency,
            specs: client.specs.map((s) => ({
              specName: s.specName,
              grade: s.grade,
              format: s.format,
              brix: s.brix ?? undefined,
              ph: s.ph ?? undefined,
              sizeCaliber: s.sizeCaliber ?? undefined,
              overripe: s.overripe ?? undefined,
              unripe: s.unripe ?? undefined,
              calyx: s.calyx ?? undefined,
              leaves: s.leaves ?? undefined,
              stems: s.stems ?? undefined,
              misshapen: s.misshapen ?? undefined,
              blemish: s.blemish ?? undefined,
              dryPump: s.dryPump ?? undefined,
              clumps: s.clumps ?? undefined,
              broken: s.broken ?? undefined,
              oxidation: s.oxidation ?? undefined,
              mechanicalDamage: s.mechanicalDamage ?? undefined,
              rotten: s.rotten ?? undefined,
              insectDamage: s.insectDamage ?? undefined,
              internalQuality: s.internalQuality ?? undefined,
              deadWorm: s.deadWorm ?? undefined,
              fungalInfection: s.fungalInfection ?? undefined,
              dryBruises: s.dryBruises ?? undefined,
              foreignBodies: s.foreignBodies ?? undefined,
              maxCfuPerGram: s.maxCfuPerGram ?? undefined,
              notes: s.notes ?? undefined,
            })),
          }}
        />
      </div>
    </div>
  );
}
