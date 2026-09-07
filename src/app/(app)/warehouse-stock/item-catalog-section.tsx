"use client";

import { useActionState, useRef } from "react";
import { addWarehouseStockItemAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { WarehouseStockItem } from "@prisma/client";

export function ItemCatalogSection({ items }: { items: WarehouseStockItem[] }) {
  const [state, formAction, pending] = useActionState(addWarehouseStockItemAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.warehouseStock;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.catalogSectionTitle}</h2>

      {items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-1 font-medium">{t.itemNameLabel}</th>
                <th className="px-3 py-1 font-medium">{t.itemDescriptionLabel}</th>
                <th className="px-3 py-1 font-medium">{t.itemCodeLabel}</th>
                <th className="px-3 py-1 font-medium">{t.itemUnitLabel}</th>
                <th className="px-3 py-1 font-medium">{t.minStockLabel}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 font-medium text-slate-900">{i.name}</td>
                  <td className="px-3 py-1">{i.description ?? "—"}</td>
                  <td className="px-3 py-1">{i.code ?? "—"}</td>
                  <td className="px-3 py-1">{i.unit ?? "—"}</td>
                  <td className="px-3 py-1">{i.minStockLevel ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noItemsInCatalogYet}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 grid grid-cols-5 gap-3 border-t border-slate-100 pt-4"
      >
        <FieldGroup label={t.itemNameLabel}>
          <Input name="name" required className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.itemDescriptionLabel}>
          <Input name="description" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.itemCodeLabel}>
          <Input name="code" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.itemUnitLabel}>
          <Input name="unit" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <FieldGroup label={t.minStockLabel}>
          <Input name="minStockLevel" type="number" min="0" step="any" className="px-2 py-1 text-xs" />
        </FieldGroup>
        <div className="col-span-5 flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.addItemToCatalog}
          </Button>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      </form>
    </div>
  );
}
