import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Real org chart supplied by the owner (iqf-org-chart.pdf, 2026-08-30).
// Idempotent by wiping all OrgPosition rows and recreating -- there's no
// natural key to upsert on (titles repeat by design, e.g. 4x "Production
// Supervisor" under one head), same pattern as import-crop-protection-plan.mjs.
const CHART = {
  title: "IQF Manager",
  personName: "Essam Ghalia",
  department: "Executive",
  children: [
    {
      title: "EHS Head",
      personName: "Safa Elsaid",
      department: "EHS",
      children: [
        { title: "Office Boy", personName: "Mahmoud Ibrahim", department: "EHS" },
        { title: "Office Cleaner", personName: "Walid Abdelsatar", department: "EHS" },
        { title: "EHS Supervisor", personName: "Mohamed Zaki", department: "EHS" },
      ],
    },
    {
      title: "Warehouse Head",
      personName: "Mahmoud Rohuma",
      department: "Warehouse",
      children: [
        { title: "Warehouse Supervisor", personName: "Islam Shehata", department: "Warehouse" },
        { title: "Warehouse Supervisor", personName: "Mohamed Fazaa", department: "Warehouse" },
        { title: "Accountant", personName: "Mohamed Ashraf", department: "Warehouse" },
      ],
    },
    {
      title: "Maintenance Head",
      personName: "Shaban Masoud",
      department: "Maintenance",
      children: [
        { title: "Maintenance Engineer", personName: "Amar Ahmed", department: "Maintenance" },
        { title: "Maintenance Engineer", personName: "Ibrahim Rezk", department: "Maintenance" },
      ],
    },
    {
      title: "Quality Head",
      personName: "Mohamed Abdelsadek",
      department: "Quality",
      children: [
        { title: "Quality Engineer", personName: "Hanan Gerges", department: "Quality" },
        { title: "Quality Engineer", personName: "Mohamed Ghaith", department: "Quality" },
      ],
    },
    {
      title: "L13 Head",
      personName: "Ahmed Abdelmotelb",
      department: "Production (L13)",
      children: [
        { title: "Production Supervisor", personName: "Farid Said", department: "Production (L13)" },
        { title: "Production Supervisor", personName: "Khaled Gamal", department: "Production (L13)" },
        { title: "Production Supervisor", personName: "Mohamed Sobhy", department: "Production (L13)" },
        { title: "Production Supervisor", personName: "Ahmed Adel", department: "Production (L13)" },
      ],
    },
    {
      title: "L11 Head",
      personName: "Ayman Hamdy",
      department: "Production (L11)",
      children: [
        { title: "Production Supervisor", personName: "Farag Abdelwenis", department: "Production (L11)" },
        { title: "Production Supervisor", personName: "Manar Salama", department: "Production (L11)" },
        { title: "Production Supervisor", personName: "Ehab Abdelsatar", department: "Production (L11)" },
        { title: "Production Supervisor", personName: "Khaled Abdallah", department: "Production (L11)" },
      ],
    },
  ],
};

async function createNode(node, reportsToId, sortOrder) {
  const position = await prisma.orgPosition.create({
    data: {
      title: node.title,
      personName: node.personName,
      department: node.department,
      reportsToId,
      sortOrder,
    },
  });
  for (let i = 0; i < (node.children ?? []).length; i++) {
    await createNode(node.children[i], position.id, i);
  }
  return position;
}

async function main() {
  const existing = await prisma.orgPosition.count();
  if (existing > 0) {
    throw new Error(`Refusing to run: ${existing} position(s) already exist. Clear them manually first if this is intentional.`);
  }

  await createNode(CHART, null, 0);

  const total = await prisma.orgPosition.count();
  console.log(`Imported org structure: ${total} positions`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
