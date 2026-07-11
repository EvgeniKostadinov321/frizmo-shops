"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Input, PriceInput, Select } from "@/components/ui";
import { saveGrowthSettings } from "@/actions/shop";
import type { Shop } from "@/db";
import { centsToInput, toCents } from "@/lib/money";

const TYPE_OPTIONS = [
  { value: "percent", label: "Процент (%)" },
  { value: "fixed", label: "Фиксирана сума (€)" },
];

interface CouponFields {
  enabled: boolean;
  type: "percent" | "fixed";
  /** Стойност като текст: процент („15“) или сума в € („5,00“). */
  value: string;
  /** Минимална сума за прилагане, като текст в € („20,00“). */
  minSubtotal: string;
}

function initFields(enabled: boolean, type: string, value: number, minCents: number): CouponFields {
  return {
    enabled,
    type: type === "fixed" ? "fixed" : "percent",
    value: type === "fixed" ? centsToInput(value) : String(value),
    minSubtotal: minCents > 0 ? centsToInput(minCents) : "",
  };
}

/** Стойността в центове/процент според типа. null = невалиден вход. */
function valueToNumber(f: CouponFields): number | null {
  if (f.type === "fixed") return toCents(f.value);
  const n = Number(f.value);
  return Number.isInteger(n) ? n : null;
}

/** В1/В2: настройки за welcome/referral купон. Стойностите се въвеждат в €/%, съхраняват се в центове. */
export function GrowthSettingsForm({ shop }: { shop: Shop }) {
  const [welcome, setWelcome] = useState<CouponFields>(
    initFields(
      shop.welcomeCouponEnabled,
      shop.welcomeCouponType,
      shop.welcomeCouponValue,
      shop.welcomeCouponMinSubtotalCents,
    ),
  );
  const [referral, setReferral] = useState<CouponFields>(
    initFields(
      shop.referralEnabled,
      shop.referralType,
      shop.referralValue,
      shop.referralMinSubtotalCents,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setSaved(false);
    const welcomeValue = valueToNumber(welcome);
    const referralValue = valueToNumber(referral);
    if (welcome.enabled && welcomeValue === null) {
      setError("Невалидна стойност за welcome купон.");
      return;
    }
    if (referral.enabled && referralValue === null) {
      setError("Невалидна стойност за реферален купон.");
      return;
    }
    startTransition(async () => {
      const res = await saveGrowthSettings({
        welcomeCouponEnabled: welcome.enabled,
        welcomeCouponType: welcome.type,
        welcomeCouponValue: welcomeValue ?? 10,
        welcomeCouponMinSubtotalCents: toCents(welcome.minSubtotal || "0") ?? 0,
        referralEnabled: referral.enabled,
        referralType: referral.type,
        referralValue: referralValue ?? 10,
        referralMinSubtotalCents: toCents(referral.minSubtotal || "0") ?? 0,
      });
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CouponSection
        title="Welcome купон"
        hint="Нов абонат получава личен еднократен код при потвърждаване на абонамента (валиден 30 дни)."
        fields={welcome}
        onChange={setWelcome}
      />
      <CouponSection
        title="Реферален купон"
        hint="Абонатът получава код за приятел — многократен, за да води нови клиенти."
        fields={referral}
        onChange={setReferral}
      />

      {error && <p className="text-sm text-danger-600">{error}</p>}
      {saved && <p className="text-sm text-success-600">Настройките са запазени.</p>}

      <div>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Запазване…" : "Запази"}
        </Button>
      </div>
    </div>
  );
}

function CouponSection({
  title,
  hint,
  fields,
  onChange,
}: {
  title: string;
  hint: string;
  fields: CouponFields;
  onChange: (f: CouponFields) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-surface-200 bg-surface-0 p-4">
      <div>
        <h3 className="font-display text-lg font-bold text-ink-900">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-500">{hint}</p>
      </div>
      <Checkbox
        label="Активен"
        checked={fields.enabled}
        onChange={(e) => onChange({ ...fields, enabled: e.target.checked })}
      />
      {fields.enabled && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Select
            label="Тип отстъпка"
            options={TYPE_OPTIONS}
            value={fields.type}
            onChange={(e) =>
              onChange({ ...fields, type: e.target.value === "fixed" ? "fixed" : "percent" })
            }
          />
          {fields.type === "percent" ? (
            <Input
              label="Отстъпка (%)"
              inputMode="numeric"
              value={fields.value}
              onChange={(e) => onChange({ ...fields, value: e.target.value })}
            />
          ) : (
            <PriceInput
              label="Отстъпка"
              value={fields.value}
              onChange={(e) => onChange({ ...fields, value: e.target.value })}
            />
          )}
          <PriceInput
            label="Мин. сума (по избор)"
            value={fields.minSubtotal}
            onChange={(e) => onChange({ ...fields, minSubtotal: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
