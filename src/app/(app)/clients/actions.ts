"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { clientSchema, specSchema } from "@/lib/validation/client";
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
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function addClientSpecAction(clientId: string, _prevState: string | undefined, formData: FormData) {
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
