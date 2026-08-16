"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { clientSchema, specSchema } from "@/lib/validation/client";
import { canManageClients } from "@/lib/roles";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireOwner() {
  const session = await auth();
  return session?.user.role === "OWNER";
}

function parseClientForm(formData: FormData) {
  const specsRaw = formData.get("specsJson");
  let specs: unknown = [];
  try {
    specs = specsRaw ? JSON.parse(String(specsRaw)) : [];
  } catch {
    specs = [];
  }

  return clientSchema.safeParse({
    name: formData.get("name"),
    country: formData.get("country") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    paymentTerms: formData.get("paymentTerms") || undefined,
    incoterms: formData.get("incoterms") || undefined,
    currency: formData.get("currency") || "USD",
    specs,
  });
}

export async function createClientAction(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canManageClients(session?.user.role)) return "You don't have permission to manage clients.";

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }
  const { specs, ...client } = parsed.data;

  const created = await prisma.client.create({
    data: { ...client, specs: { create: specs } },
  });

  revalidatePath("/clients");
  redirect(`/clients/${created.id}`);
}

export async function updateClientAction(id: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canManageClients(session?.user.role)) return "You don't have permission to manage clients.";

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }
  const { specs, ...client } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: client });
    await tx.clientSpec.deleteMany({ where: { clientId: id } });
    if (specs.length) {
      await tx.clientSpec.createMany({ data: specs.map((s) => ({ ...s, clientId: id })) });
    }
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}`);
}

export async function deleteClientAction(id: string) {
  if (!(await requireOwner())) return;
  try {
    await prisma.client.delete({ where: { id } });
  } catch (err) {
    // Client is a required FK on Order/Claim -- Prisma refuses the delete
    // (P2003) rather than orphaning real order/claim history. Redirect back
    // with an explanatory error instead of a raw 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      redirect(`/clients/${id}?error=in-use`);
    }
    throw err;
  }
  revalidatePath("/clients");
  redirect("/clients");
}

export async function addClientSpecAction(clientId: string, _prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!canManageClients(session?.user.role)) return "You don't have permission to manage clients.";

  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = specSchema.safeParse(raw);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  await prisma.clientSpec.create({ data: { ...parsed.data, clientId } });

  revalidatePath(`/clients/${clientId}`);
  return "ok";
}
