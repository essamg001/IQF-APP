import type { LabourDepartment, LabourRoleType } from "@prisma/client";

export const LABOUR_DEPARTMENTS: LabourDepartment[] = [
  "INTAKE",
  "INFEED",
  "PROCESSING",
  "OPERATIONS_EFFICIENCY",
  "QUALITY_CONTROL",
  "MAINTENANCE_ENGINEERING",
  "PACKAGING",
  "LOAD_OUT",
  "CLEANING",
];

export const LABOUR_DEPARTMENT_LABEL: Record<LabourDepartment, string> = {
  INTAKE: "Intake",
  INFEED: "Infeed",
  PROCESSING: "Processing",
  OPERATIONS_EFFICIENCY: "Operations Efficiency",
  QUALITY_CONTROL: "Quality Control",
  MAINTENANCE_ENGINEERING: "Maintenance / Engineering",
  PACKAGING: "Packaging",
  LOAD_OUT: "Load Out",
  CLEANING: "Cleaning",
};

// Which roles are actually staffed in each department -- e.g. Cleaning never
// gets a Forklift Driver row, so that combination is never shown as an input
// or accepted by updateDepartmentLabourEntryAction. Confirmed against the
// real factory layout, not guessed per-role defaults.
export const LABOUR_ROLE_MATRIX: Record<LabourDepartment, LabourRoleType[]> = {
  INTAKE: ["SUPERVISOR", "FORKLIFT_DRIVER", "DAILY_WORKER"],
  INFEED: ["SUPERVISOR", "DAILY_WORKER"],
  PROCESSING: ["SUPERVISOR", "DAILY_WORKER"],
  OPERATIONS_EFFICIENCY: ["SUPERVISOR", "DAILY_WORKER"],
  QUALITY_CONTROL: ["SUPERVISOR", "DAILY_WORKER"],
  MAINTENANCE_ENGINEERING: ["SUPERVISOR", "DAILY_WORKER"],
  PACKAGING: ["SUPERVISOR", "FORKLIFT_DRIVER", "DAILY_WORKER"],
  LOAD_OUT: ["SUPERVISOR", "FORKLIFT_DRIVER", "DAILY_WORKER"],
  CLEANING: ["SUPERVISOR", "DAILY_WORKER"],
};

// Supervisors are recorded by name (who's actually responsible for this
// department this shift) -- every other role is recorded by headcount.
export function isNameBasedRole(role: LabourRoleType): boolean {
  return role === "SUPERVISOR";
}
