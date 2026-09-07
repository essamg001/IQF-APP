"use client";

import { useActionState, useState } from "react";
import { createPurchaseRequestAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

type LineItem = {
  categories: string[];
  itemDescription: string;
  quantity?: string;
  unit?: string;
  reason?: string;
  sourceType?: string;
};

const EMPTY_ITEM: LineItem = { categories: [], itemDescription: "" };

const CATEGORY_OPTIONS = ["CLEANING_MATERIALS", "EQUIPMENT", "SPARE_PARTS", "OTHER"] as const;

function ItemRow({
  item,
  onChange,
  onRemove,
  canRemove,
}: {
  item: LineItem;
  onChange: (next: LineItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { purchaseRequests: dict, common } = useTranslations();
  const set = <K extends keyof LineItem>(key: K, value: LineItem[K]) => onChange({ ...item, [key]: value });

  const CATEGORY_LABEL: Record<(typeof CATEGORY_OPTIONS)[number], string> = {
    CLEANING_MATERIALS: dict.categoryCleaningMaterials,
    EQUIPMENT: dict.categoryEquipment,
    SPARE_PARTS: dict.categorySpareParts,
    OTHER: common.other,
  };

  const toggleCategory = (value: string) => {
    const next = item.categories.includes(value)
      ? item.categories.filter((c) => c !== value)
      : [...item.categories, value];
    set("categories", next);
  };

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex items-center justify-between">
        <FieldGroup label={dict.colItem}>
          <Input
            value={item.itemDescription}
            onChange={(e) => set("itemDescription", e.target.value)}
            placeholder={dict.formItemPlaceholder}
            className="w-64"
            required
          />
        </FieldGroup>
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline">
            {common.remove}
          </button>
        )}
      </div>

      <FieldGroup label={dict.colCategory}>
        <div className="flex flex-wrap gap-3">
          {CATEGORY_OPTIONS.map((value) => (
            <label key={value} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={item.categories.includes(value)}
                onChange={() => toggleCategory(value)}
                className="rounded border-slate-300"
              />
              {CATEGORY_LABEL[value]}
            </label>
          ))}
        </div>
      </FieldGroup>

      <div className="mt-3 grid grid-cols-4 gap-3">
        <FieldGroup label={dict.rowQuantity}>
          <Input
            value={item.quantity ?? ""}
            onChange={(e) => set("quantity", e.target.value)}
            placeholder={dict.formQuantityPlaceholder}
          />
        </FieldGroup>
        <FieldGroup label={dict.colUnit}>
          <Input value={item.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder={dict.formUnitPlaceholder} />
        </FieldGroup>
        <FieldGroup label={dict.colSource}>
          <Select value={item.sourceType ?? ""} onChange={(e) => set("sourceType", e.target.value)}>
            <option value="">{dict.sourceUnspecified}</option>
            <option value="LOCAL">{dict.sourceLocal}</option>
            <option value="IMPORTED">{dict.sourceImported}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.formReason}>
          <Input value={item.reason ?? ""} onChange={(e) => set("reason", e.target.value)} placeholder={dict.formReasonPlaceholder} />
        </FieldGroup>
      </div>
    </div>
  );
}

export function RequestForm({ factories }: { factories: Factory[] }) {
  const [error, formAction, pending] = useActionState(createPurchaseRequestAction, undefined);
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [isJointOrder, setIsJointOrder] = useState(false);
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <FieldGroup label={common.factory}>
          <Select name="factoryId" required={!isJointOrder} disabled={isJointOrder} defaultValue={factories[0]?.id ?? ""}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="isJointOrder"
            checked={isJointOrder}
            onChange={(e) => setIsJointOrder(e.target.checked)}
            className="rounded border-slate-300"
          />
          {dict.jointOrderLabel}
        </label>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{dict.itemsCardTitle}</h2>
          <Button type="button" variant="secondary" onClick={() => setItems([...items, { ...EMPTY_ITEM }])}>
            {dict.addItemRow}
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => (
            <ItemRow
              key={i}
              item={item}
              canRemove={items.length > 1}
              onChange={(next) => setItems(items.map((it, j) => (j === i ? next : it)))}
              onRemove={() => setItems(items.filter((_, j) => j !== i))}
            />
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <FieldGroup label={dict.formPhoto}>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="block w-full text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
      </Card>

      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? common.submitting : dict.submitRequest}
      </Button>
    </form>
  );
}
