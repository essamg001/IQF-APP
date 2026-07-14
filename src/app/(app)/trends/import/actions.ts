"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const EXPECTED_HEADER = ["orderNumber", "clientName", "grade", "format", "quantityPallets", "valueUsd", "orderDate"];

export async function importHistoricalOrdersAction(_prevState: string | undefined, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return "Please choose a CSV file.";
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return "The file has no data rows.";

  const header = lines[0].split(",").map((h) => h.trim());
  if (header.join(",") !== EXPECTED_HEADER.join(",")) {
    return `Header must be exactly: ${EXPECTED_HEADER.join(",")}`;
  }

  const clients = await prisma.client.findMany();
  const clientByName = new Map(clients.map((c) => [c.name.toLowerCase(), c]));

  const errors: string[] = [];
  const rowsToCreate: {
    orderNumber: string;
    clientId: string;
    grade: "A" | "B";
    format: "WHOLE" | "SLICED";
    quantityPallets: number;
    valueUsd: number;
    orderDate: Date;
    isHistorical: true;
    stage: "PAID";
  }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const [orderNumber, clientName, grade, format, quantityPallets, valueUsd, orderDate] = cols;
    const client = clientByName.get((clientName ?? "").toLowerCase());
    if (!client) {
      errors.push(`Row ${i + 1}: unknown client "${clientName}"`);
      continue;
    }
    if (grade !== "A" && grade !== "B") {
      errors.push(`Row ${i + 1}: grade must be A or B`);
      continue;
    }
    if (format !== "WHOLE" && format !== "SLICED") {
      errors.push(`Row ${i + 1}: format must be WHOLE or SLICED`);
      continue;
    }
    const date = new Date(orderDate);
    if (isNaN(date.getTime())) {
      errors.push(`Row ${i + 1}: invalid date "${orderDate}"`);
      continue;
    }
    rowsToCreate.push({
      orderNumber,
      clientId: client.id,
      grade,
      format,
      quantityPallets: Number(quantityPallets) || 0,
      valueUsd: Number(valueUsd) || 0,
      orderDate: date,
      isHistorical: true,
      stage: "PAID",
    });
  }

  if (rowsToCreate.length > 0) {
    await prisma.order.createMany({ data: rowsToCreate, skipDuplicates: true });
  }

  revalidatePath("/trends");

  if (errors.length > 0) {
    return `Imported ${rowsToCreate.length} row(s). ${errors.length} row(s) skipped: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}`;
  }
  return `Imported ${rowsToCreate.length} row(s) successfully.`;
}
