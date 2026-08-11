import { prisma } from "@/lib/prisma";

// CompanySettings is a singleton -- there's exactly one row, created on
// first access, since there's no natural per-factory or per-client owner
// for a company-wide fact like GlobalG.A.P. accreditation.
export async function getCompanySettings() {
  const existing = await prisma.companySettings.findFirst();
  if (existing) return existing;
  return prisma.companySettings.create({ data: {} });
}
