"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Input } from "@/components/ui";
import { saveBillingDetails, type BillingDetailsState } from "@/actions/billing-details";
import type { MerchantBillingDetails } from "@/db/queries/billing-details";

type ClientType = "company" | "individual";

/**
 * Форма за данъчните данни на търговеца (за официалната inv.bg фактура на таксата).
 * Toggle фирма/физическо лице — сменя задължителните полета (ЕИК+МОЛ / ЕГН).
 * Показва се в card-gate момента и в Настройки → Фактуриране (за редакция).
 */
export function BillingDetailsForm({ details }: { details: MerchantBillingDetails | null }) {
  const [clientType, setClientType] = useState<ClientType>(details?.clientType ?? "company");
  const [state, action] = useActionState(saveBillingDetails, {} as BillingDetailsState);

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Данните за фактуриране са запазени.");
  }, [state.ok]);

  const isCompany = clientType === "company";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h3 className="font-bold text-ink-900">Данни за фактура</h3>
        <p className="mt-1 text-sm text-ink-500">
          За издаване на официална фактура за месечната такса. Изисква се по закон.
        </p>
      </div>

      {/* Toggle фирма / физическо лице — segment бутони. */}
      <div
        role="radiogroup"
        aria-label="Тип получател"
        className="inline-flex rounded-control border border-surface-200 p-1"
      >
        {(
          [
            ["company", "Фирма"],
            ["individual", "Физическо лице"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={clientType === value}
            onClick={() => setClientType(value)}
            className={`h-9 rounded-[calc(var(--radius-control)-2px)] px-4 text-sm font-medium transition-colors ${
              clientType === value ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Носи стойността към action-а (бутоните не са form control). */}
      <input type="hidden" name="clientType" value={clientType} />

      <Input
        name="companyName"
        label={isCompany ? "Име на фирмата" : "Име и фамилия"}
        defaultValue={details?.companyName ?? ""}
        required
        maxLength={200}
      />

      {isCompany ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            name="eik"
            label="ЕИК / Булстат"
            defaultValue={details?.eik ?? ""}
            inputMode="numeric"
            placeholder="123456789"
            className="flex-1"
          />
          <Input
            name="mol"
            label="МОЛ (отговорно лице)"
            defaultValue={details?.mol ?? ""}
            maxLength={200}
            className="flex-1"
          />
        </div>
      ) : (
        <Input
          name="egn"
          label="ЕГН"
          defaultValue={details?.egn ?? ""}
          inputMode="numeric"
          placeholder="7501010101"
        />
      )}

      {isCompany && (
        <Input
          name="vatNumber"
          label="ДДС номер (по избор)"
          defaultValue={details?.vatNumber ?? ""}
          placeholder="BG123456789"
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <Input
          name="address"
          label="Адрес"
          defaultValue={details?.address ?? ""}
          required
          maxLength={300}
          className="flex-1"
        />
        <Input
          name="city"
          label="Населено място"
          defaultValue={details?.city ?? ""}
          required
          maxLength={100}
          className="flex-1"
        />
      </div>

      <Checkbox
        name="wantsInvoice"
        value="true"
        defaultChecked={details?.wantsInvoice ?? true}
        label="Искам официална фактура за таксата"
      />

      {state.error && <p className="text-sm text-danger-600">{state.error}</p>}

      <div>
        <Button type="submit">Запази данните</Button>
      </div>
    </form>
  );
}
