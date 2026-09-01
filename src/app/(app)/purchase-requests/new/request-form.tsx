"use client";

import { useActionState, useState } from "react";
import { createPurchaseRequestAction } from "../actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { Factory } from "@prisma/client";

type LineItem = {
  category: string;
  itemDescription: string;
  quantity?: string;
  reason?: string;
};

const EMPTY_ITEM: LineItem = { category: "CLEANING_MATERIALS", itemDescription: "" };

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
  const set = (key: keyof LineItem, value: string) => onChange({ ...item, [key]: value });

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
      <div className="mt-3 grid grid-cols-3 gap-3">
        <FieldGroup label={dict.colCategory}>
          <Select value={item.category} onChange={(e) => set("category", e.target.value)}>
            <option value="CLEANING_MATERIALS">{dict.categoryCleaningMaterials}</option>
            <option value="EQUIPMENT">{dict.categoryEquipment}</option>
            <option value="SPARE_PARTS">{dict.categorySpareParts}</option>
            <option value="OTHER">{common.other}</option>
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.rowQuantity}>
          <Input
            value={item.quantity ?? ""}
            onChange={(e) => set("quantity", e.target.value)}
            placeholder={dict.formQuantityPlaceholder}
          />
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
  const { purchaseRequests: dict, common } = useTranslations();

  return (
    <form action={formAction} className="space-y-4">
      <Card className="space-y-4">
        <FieldGroup label={common.factory}>
          <Select name="factoryId" required defaultValue={factories[0]?.id ?? ""}>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label={dict.formPhoto}>
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="block w-full text-sm text-slate-700 file:me-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
        </FieldGroup>
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

      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? common.submitting : dict.submitRequest}
      </Button>
    </form>
  );
}
