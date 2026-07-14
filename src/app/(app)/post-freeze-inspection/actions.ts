"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const postFreezeSchema = z.object({
  lotId: z.string().min(1),
  palletId: z.string().optional(),
  brix: z.coerce.number().min(0).max(30),
  fruitColorPct: z.coerce.number().min(0).max(100).default(0),
  internalQualityPct: z.coerce.number().min(0).max(100).default(0),
  mouldPct: z.coerce.number().min(0).max(100).default(0),
  skinDamagePct: z.coerce.number().min(0).max(100).default(0),
  sizeCaliber: z.string().optional(),
  fullPallet: z.boolean().optional(),
  packageClosureOk: z.boolean().optional(),
  dataLabelReviewOk: z.boolean().optional(),
  foreignOdor: z.string().optional(),
  foreignTaste: z.string().optional(),
  overmaturePct: z.coerce.number().optional(),
  notes: z.string().optional(),
});

export async function createPostFreezeCheckAction(_prevState: string | undefined, formData: FormData) {
  const raw = Object.fromEntries(
    Array.from(formData.entries()).map(([k, v]) => [k, v === "" ? undefined : v])
  );
  const parsed = postFreezeSchema.safeParse({
    ...raw,
    fullPallet: formData.get("fullPallet") === "on",
    packageClosureOk: formData.get("packageClosureOk") === "on",
    dataLabelReviewOk: formData.get("dataLabelReviewOk") === "on",
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Invalid input.";
  }

  const session = await auth();
  const created = await prisma.qualityCheck.create({
    data: {
      ...parsed.data,
      checkpoint: "POST_PACKAGING",
      inspectorId: session?.user.id,
    },
  });

  revalidatePath("/post-freeze-inspection");
  return `ok:${created.id}`;
}
