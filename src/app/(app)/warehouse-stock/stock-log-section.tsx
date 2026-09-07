"use client";

import { useActionState, useRef, useState } from "react";
import { addWarehouseStockLogItemAction } from "./actions";
import { Input, Select, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { closingBalance } from "@/lib/packagingMaterials";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { WarehouseStockItem, WarehouseStockLogItem } from "@prisma/client";

export function StockLogSection({
  logId,
  items,
  priorByItem,
  catalog,
}: {
  logId: string;
  items: WarehouseStockLogItem[];
  priorByItem: Record<string, { closingBalance: number }>;
  catalog: WarehouseStockItem[];
}) {
  const [state, formAction, pending] = useActionState(addWarehouseStockLogItemAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.warehouseStock;

  const [itemId, setItemId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingTouched, setOpeningTouched] = useState(false);

  function applyPriorMatch(id: string) {
    const prior = priorByItem[id];
    if (!prior || openingTouched) return;
    setOpeningBalance(String(prior.closingBalance));
  }

  function resetForm() {
    setItemId("");
    setOpeningBalance("");
    setOpeningTouched(false);
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.logItemsTitle}</h2>

      {items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-1 font-medium">{t.itemNameLabel}</th>
                <th className="px-3 py-1 font-medium">{t.itemUnitLabel}</th>
                <th className="px-3 py-1 font-medium">{t.colOpening}</th>
                <th className="px-3 py-1 font-medium">{t.colReceived}</th>
                <th className="px-3 py-1 font-medium">{t.colUsed}</th>
                <th className="px-3 py-1 font-medium">{t.colDamaged}</th>
                <th className="px-3 py-1 font-medium">{t.colClosing}</th>
                <th className="px-3 py-1 font-medium">{t.colIssuedTo}</th>
                <th className="px-3 py-1 font-medium">{t.colReason}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 font-medium text-slate-900">{it.itemName}</td>
                  <td className="px-3 py-1">{it.unit ?? "—"}</td>
                  <td className="px-3 py-1">{it.openingBalance ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityReceived ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityUsed ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityDamaged ?? "—"}</td>
                  <td className="px-3 py-1 font-medium">
                    {closingBalance(it.openingBalance, it.quantityReceived, it.quantityUsed, it.quantityDamaged) ?? "—"}
                  </td>
                  <td className="px-3 py-1">{it.issuedTo ?? "—"}</td>
                  <td className="px-3 py-1">{it.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noLogItemsYet}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          resetForm();
        }}
        className="mt-4 space-y-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="logId" value={logId} />
        <div className="grid grid-cols-5 gap-3">
          <FieldGroup label={t.itemNameLabel}>
            <Select
              name="itemId"
              required
              className="px-2 py-1 text-xs"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                applyPriorMatch(e.target.value);
              }}
            >
              <option value="" disabled>
                {t.selectItemPlaceholder}
              </option>
              {catalog.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.unit ? `${i.name} (${i.unit})` : i.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label={t.openingBalanceLabel}>
            <Input
              name="openingBalance"
              type="number"
              min="0"
              className="px-2 py-1 text-xs"
              value={openingBalance}
              onChange={(e) => {
                setOpeningTouched(true);
                setOpeningBalance(e.target.value);
              }}
            />
          </FieldGroup>
          <FieldGroup label={t.quantityReceivedLabel}>
            <Input name="quantityReceived" type="number" min="0" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.quantityUsedLabel}>
            <Input name="quantityUsed" type="number" min="0" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.quantityDamagedLabel}>
            <Input name="quantityDamaged" type="number" min="0" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={t.issuedToLabel}>
            <Input name="issuedTo" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.reasonLabel}>
            <Input name="reason" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.addLogItem}
          </Button>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      </form>
    </div>
  );
}
