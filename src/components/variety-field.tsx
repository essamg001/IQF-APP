"use client";

import { useState } from "react";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { useTranslations } from "@/lib/i18n/locale-context";

// ~95% of the crop is Festival (per the Owner) -- default to it and only ask
// for manual entry when it's genuinely something else, instead of retyping
// the same variety name on every form.
export const DEFAULT_VARIETY = "Festival";

export function VarietyField({
  name = "varietyName",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string | null;
}) {
  const dict = useTranslations();
  const isOther = !!defaultValue && defaultValue !== DEFAULT_VARIETY;
  const [choice, setChoice] = useState(isOther ? "OTHER" : DEFAULT_VARIETY);

  return (
    <FieldGroup label={dict.common.variety}>
      <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value={DEFAULT_VARIETY}>{DEFAULT_VARIETY}</option>
        <option value="OTHER">{dict.common.other}</option>
      </Select>
      {choice === "OTHER" ? (
        <Input
          name={name}
          className="mt-2"
          placeholder={dict.common.variety}
          defaultValue={isOther ? defaultValue ?? "" : ""}
        />
      ) : (
        <input type="hidden" name={name} value={DEFAULT_VARIETY} />
      )}
    </FieldGroup>
  );
}
