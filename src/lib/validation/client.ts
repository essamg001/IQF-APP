import { z } from "zod";

export const specSchema = z.object({
  specName: z.string().min(1, "Spec name is required"),
  grade: z.enum(["A", "B"]),
  format: z.enum(["WHOLE", "SLICED", "DICED"]),
  brix: z.string().optional(),
  ph: z.string().optional(),
  sizeCaliber: z.string().optional(),
  overripe: z.string().optional(),
  unripe: z.string().optional(),
  calyx: z.string().optional(),
  leaves: z.string().optional(),
  stems: z.string().optional(),
  misshapen: z.string().optional(),
  blemish: z.string().optional(),
  dryPump: z.string().optional(),
  clumps: z.string().optional(),
  broken: z.string().optional(),
  oxidation: z.string().optional(),
  mechanicalDamage: z.string().optional(),
  rotten: z.string().optional(),
  insectDamage: z.string().optional(),
  internalQuality: z.string().optional(),
  deadWorm: z.string().optional(),
  fungalInfection: z.string().optional(),
  dryBruises: z.string().optional(),
  foreignBodies: z.string().optional(),
  maxCfuPerGram: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export type SpecInput = z.infer<typeof specSchema>;

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  country: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
  paymentTerms: z.string().optional(),
  incoterms: z.string().optional(),
  currency: z.string().default("USD"),
  specs: z.array(specSchema).default([]),
});

export type ClientInput = z.infer<typeof clientSchema>;

export const DEFECT_FIELDS = [
  { key: "overripe", label: "Over-ripe" },
  { key: "unripe", label: "Unripe" },
  { key: "calyx", label: "Calyx" },
  { key: "leaves", label: "Leaves" },
  { key: "stems", label: "Stems" },
  { key: "misshapen", label: "Misshapen" },
  { key: "blemish", label: "Blemish" },
  { key: "dryPump", label: "Dry Pump" },
  { key: "clumps", label: "Clumps" },
  { key: "broken", label: "Broken" },
  { key: "oxidation", label: "Oxidation" },
  { key: "mechanicalDamage", label: "Mechanical Damage" },
  { key: "rotten", label: "Rotten" },
  { key: "insectDamage", label: "Insect Damage" },
  { key: "internalQuality", label: "Internal Quality" },
  { key: "deadWorm", label: "Dead Worm" },
  { key: "fungalInfection", label: "Fungal Infection" },
  { key: "dryBruises", label: "Dry Bruises" },
  { key: "foreignBodies", label: "Foreign Bodies" },
] as const;
