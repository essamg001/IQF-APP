"use client";

import { useActionState, useRef, useState } from "react";
import { addPackagingMaterialItemAction } from "./actions";
import { Input, FieldGroup } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { closingBalance } from "@/lib/packagingMaterials";
import { format } from "date-fns";
import { useTranslations } from "@/lib/i18n/locale-context";
import type { PackagingMaterialItem } from "@prisma/client";

type PriorInfo = {
  closingBalance: number;
  productCode: string | null;
  productUnit: string | null;
  minLevel: number | null;
  maxLevel: number | null;
};

export function ItemRegisterSection({
  dailyLogId,
  items,
  priorByItem,
  knownNames,
}: {
  dailyLogId: string;
  items: PackagingMaterialItem[];
  priorByItem: Record<string, PriorInfo>;
  knownNames: string[];
}) {
  const [state, formAction, pending] = useActionState(addPackagingMaterialItemAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const errorMessage = state && state !== "ok" ? state : undefined;
  const dict = useTranslations();
  const t = dict.packagingMaterials;

  const [itemName, setItemName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingTouched, setOpeningTouched] = useState(false);
  const [productCode, setProductCode] = useState("");
  const [productUnit, setProductUnit] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [maxLevel, setMaxLevel] = useState("");
  const [staticTouched, setStaticTouched] = useState(false);

  function applyPriorMatch(name: string) {
    const prior = priorByItem[name.trim().toLowerCase()];
    if (!prior) return;
    if (!openingTouched) setOpeningBalance(String(prior.closingBalance));
    if (!staticTouched) {
      setProductCode(prior.productCode ?? "");
      setProductUnit(prior.productUnit ?? "");
      setMinLevel(prior.minLevel != null ? String(prior.minLevel) : "");
      setMaxLevel(prior.maxLevel != null ? String(prior.maxLevel) : "");
    }
  }

  function resetForm() {
    setItemName("");
    setOpeningBalance("");
    setOpeningTouched(false);
    setProductCode("");
    setProductUnit("");
    setMinLevel("");
    setMaxLevel("");
    setStaticTouched(false);
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">{t.itemsTitle}</h2>

      {items.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-200 text-slate-500 text-xs">
              <tr>
                <th className="px-3 py-1 font-medium">{t.colItem}</th>
                <th className="px-3 py-1 font-medium">{t.colCode}</th>
                <th className="px-3 py-1 font-medium">{t.colUnit}</th>
                <th className="px-3 py-1 font-medium">{t.colMinMax}</th>
                <th className="px-3 py-1 font-medium">{t.colOpening}</th>
                <th className="px-3 py-1 font-medium">{t.colReceived}</th>
                <th className="px-3 py-1 font-medium">{t.colUsed}</th>
                <th className="px-3 py-1 font-medium">{t.colDamaged}</th>
                <th className="px-3 py-1 font-medium">{t.colClosing}</th>
                <th className="px-3 py-1 font-medium">{t.colVoucher}</th>
                <th className="px-3 py-1 font-medium">{t.colDestination}</th>
                <th className="px-3 py-1 font-medium">{t.colExpiry}</th>
                <th className="px-3 py-1 font-medium">{t.colLocation}</th>
                <th className="px-3 py-1 font-medium">{t.colLot}</th>
                <th className="px-3 py-1 font-medium">{t.colStoreKeeper}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-1 font-medium text-slate-900">{it.itemName}</td>
                  <td className="px-3 py-1">{it.productCode ?? "—"}</td>
                  <td className="px-3 py-1">{it.productUnit ?? "—"}</td>
                  <td className="px-3 py-1">
                    {it.minLevel ?? "—"} / {it.maxLevel ?? "—"}
                  </td>
                  <td className="px-3 py-1">{it.openingBalance ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityReceived ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityUsed ?? "—"}</td>
                  <td className="px-3 py-1">{it.quantityDamaged ?? "—"}</td>
                  <td className="px-3 py-1 font-medium">
                    {closingBalance(it.openingBalance, it.quantityReceived, it.quantityUsed, it.quantityDamaged) ??
                      "—"}
                  </td>
                  <td className="px-3 py-1">{it.receiptOrVoucherNumber ?? "—"}</td>
                  <td className="px-3 py-1">{it.supplyOrIssueDestination ?? "—"}</td>
                  <td className="px-3 py-1">{it.expiryDate ? format(it.expiryDate, "dd MMM yyyy") : "—"}</td>
                  <td className="px-3 py-1">{it.storageLocation ?? "—"}</td>
                  <td className="px-3 py-1">{it.lotNumber ?? "—"}</td>
                  <td className="px-3 py-1">{it.storeKeeperName ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {items.length === 0 && <p className="mt-3 text-sm text-slate-400">{t.noItemsYet}</p>}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          resetForm();
        }}
        className="mt-4 space-y-3 border-t border-slate-100 pt-4"
      >
        <input type="hidden" name="dailyLogId" value={dailyLogId} />
        <div className="grid grid-cols-5 gap-3">
          <FieldGroup label={t.itemNameLabel}>
            <Input
              name="itemName"
              list="packaging-item-names"
              required
              className="px-2 py-1 text-xs"
              value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                applyPriorMatch(e.target.value);
              }}
            />
            <datalist id="packaging-item-names">
              {knownNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </FieldGroup>
          <FieldGroup label={t.productCodeLabel}>
            <Input
              name="productCode"
              className="px-2 py-1 text-xs"
              value={productCode}
              onChange={(e) => {
                setStaticTouched(true);
                setProductCode(e.target.value);
              }}
            />
          </FieldGroup>
          <FieldGroup label={t.unitLabel}>
            <Input
              name="productUnit"
              className="px-2 py-1 text-xs"
              value={productUnit}
              onChange={(e) => {
                setStaticTouched(true);
                setProductUnit(e.target.value);
              }}
            />
          </FieldGroup>
          <FieldGroup label={t.minLevelLabel}>
            <Input
              name="minLevel"
              type="number"
              min="0"
              className="px-2 py-1 text-xs"
              value={minLevel}
              onChange={(e) => {
                setStaticTouched(true);
                setMinLevel(e.target.value);
              }}
            />
          </FieldGroup>
          <FieldGroup label={t.maxLevelLabel}>
            <Input
              name="maxLevel"
              type="number"
              min="0"
              className="px-2 py-1 text-xs"
              value={maxLevel}
              onChange={(e) => {
                setStaticTouched(true);
                setMaxLevel(e.target.value);
              }}
            />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-5 gap-3">
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
          <FieldGroup label={t.lotNumberLabel}>
            <Input name="lotNumber" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-5 gap-3">
          <FieldGroup label={t.receiptVoucherLabel}>
            <Input name="receiptOrVoucherNumber" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.supplyDestinationLabel}>
            <Input name="supplyOrIssueDestination" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.expiryDateLabel}>
            <Input name="expiryDate" type="date" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.storageLocationLabel}>
            <Input name="storageLocation" className="px-2 py-1 text-xs" />
          </FieldGroup>
          <FieldGroup label={t.storeKeeperLabel}>
            <Input name="storeKeeperName" className="px-2 py-1 text-xs" />
          </FieldGroup>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="secondary" disabled={pending} className="px-2 py-1 text-xs">
            {pending ? dict.common.saving : t.addItem}
          </Button>
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      </form>
    </div>
  );
}
