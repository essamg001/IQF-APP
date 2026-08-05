"use client";

import { useMemo, useState } from "react";

/**
 * Live running total across a fixed set of %-defect fields, so an inspector
 * sees the aggregate limit approaching before submitting, not only in the
 * warning that comes back after -- easy to blow past by accident when there
 * are a dozen-plus individually-small-looking fields.
 */
export function useDefectTotal(fieldNames: readonly string[]) {
  const [values, setValues] = useState<Record<string, string>>({});

  const total = useMemo(
    () => fieldNames.reduce((sum, name) => sum + (parseFloat(values[name] ?? "") || 0), 0),
    [values, fieldNames]
  );

  const bind = (name: string) => ({
    value: values[name] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  return { total, bind };
}
