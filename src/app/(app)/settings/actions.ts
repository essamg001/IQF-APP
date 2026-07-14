"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";

const factorySchema = z.object({
  name: z.string().min(1),
  capacityTonnesPerHour: z.coerce.number().positive(),
});

const coldRoomSchema = z.object({
  name: z.string().min(1),
  capacityPallets: z.coerce.number().int().positive(),
  isNew: z.boolean(),
});

const fieldSchema = z.object({
  name: z.string().min(1),
  mapReference: z.string().optional(),
});

export async function addFactoryAction(formData: FormData) {
  const parsed = factorySchema.parse({
    name: formData.get("name"),
    capacityTonnesPerHour: formData.get("capacityTonnesPerHour"),
  });
  await prisma.factory.create({ data: parsed });
  revalidatePath("/settings");
}

export async function addColdRoomAction(formData: FormData) {
  const parsed = coldRoomSchema.parse({
    name: formData.get("name"),
    capacityPallets: formData.get("capacityPallets"),
    isNew: formData.get("isNew") === "on",
  });
  await prisma.coldRoom.create({ data: parsed });
  revalidatePath("/settings");
}

export async function addFieldAction(formData: FormData) {
  const parsed = fieldSchema.parse({
    name: formData.get("name"),
    mapReference: formData.get("mapReference") || undefined,
  });
  await prisma.field.create({ data: parsed });
  revalidatePath("/settings");
}

export async function deleteFieldAction(id: string) {
  await prisma.field.delete({ where: { id } });
  revalidatePath("/settings");
}

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["OWNER", "SALES", "QUALITY", "PRODUCTION", "LOGISTICS"]),
  password: z.string().min(6),
  isHeadOfSales: z.boolean(),
  station: z.enum(["ARRIVAL_INSPECTION", "POST_FREEZE_INSPECTION", "LOAD_OUT", "FINAL_PRODUCT_ENTRY", "LAB"]).optional(),
});

export async function addUserAction(_prevState: string | undefined, formData: FormData) {
  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
    isHeadOfSales: formData.get("isHeadOfSales") === "on",
    station: formData.get("station") || undefined,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return "A user with this email already exists.";

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      isHeadOfSales: parsed.data.isHeadOfSales,
      station: parsed.data.station,
      passwordHash,
    },
  });

  revalidatePath("/settings");
}

export async function deleteUserAction(id: string) {
  await prisma.user.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function toggleHeadOfSalesAction(id: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  await prisma.user.update({ where: { id }, data: { isHeadOfSales: !user.isHeadOfSales } });
  revalidatePath("/settings");
}
