"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Input, PriceInput, Select } from "@/components/ui";
import { saveGrowthSettings } from "@/actions/shop";
import type { Shop } from "@/db";
import { centsToInput, toCents } from "@/lib/money";
import { isDirty } from "@/lib/is-dirty";

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

/**
 * Валидира стойността според типа и връща или числото (center/percent), или
 * конкретно съобщение за грешка. Огледало на серверната Zod валидация, за да
 * покажем грешката под точното поле още преди submit.
 */
function validateCoupon(f: CouponFields): { value: number } | { error: string } {
  if (f.type === "fixed") {
    const cents = toCents(f.value);
    if (cents === null || cents < 1) return { error: "Въведи валидна сума (напр. 5,00)" };
    return { value: cents };
  }
  const n = Number(f.value);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return { error: "Процентът трябва да е между 1 и 100" };
  }
  return { value: n };
}

/** В1/В2: настройки за welcome/referral купон. Стойностите се въвеждат в €/%, съхраняват се в центове. */
export function GrowthSettingsForm({ shop }: { shop: Shop }) {
  const router = useRouter();
  /* Началните стойности от props-ите — базата за dirty-сравнението (обновява се
     след router.refresh(), така формата пак става „чиста" след запис). */
  const baseWelcome = initFields(
    shop.welcomeCouponEnabled,
    shop.welcomeCouponType,
    shop.welcomeCouponValue,
    shop.welcomeCouponMinSubtotalCents,
  );
  const baseReferral = initFields(
    shop.referralEnabled,
    shop.referralType,
    shop.referralValue,
    shop.referralMinSubtotalCents,
  );
  const [welcome, setWelcome] = useState<CouponFields>(baseWelcome);
  const [referral, setReferral] = useState<CouponFields>(baseReferral);
  const [fieldErrors, setFieldErrors] = useState<{ welcome?: string; referral?: string }>({});
  const [pending, startTransition] = useTransition();
  const dirty = isDirty({ welcome, referral }, { welcome: baseWelcome, referral: baseReferral });

  function submit() {
    setFieldErrors({});

    const fieldErrs: { welcome?: string; referral?: string } = {};
    const welcomeRes = welcome.enabled ? validateCoupon(welcome) : { value: 10 };
    const referralRes = referral.enabled ? validateCoupon(referral) : { value: 10 };
    if ("error" in welcomeRes) fieldErrs.welcome = welcomeRes.error;
    if ("error" in referralRes) fieldErrs.referral = referralRes.error;
    if (fieldErrs.welcome || fieldErrs.referral) {
      setFieldErrors(fieldErrs);
      return;
    }

    startTransition(async () => {
      const res = await saveGrowthSettings({
        welcomeCouponEnabled: welcome.enabled,
        welcomeCouponType: welcome.type,
        welcomeCouponValue: (welcomeRes as { value: number }).value,
        welcomeCouponMinSubtotalCents: toCents(welcome.minSubtotal || "0") ?? 0,
        referralEnabled: referral.enabled,
        referralType: referral.type,
        referralValue: (referralRes as { value: number }).value,
        referralMinSubtotalCents: toCents(referral.minSubtotal || "0") ?? 0,
      });
      if (res.ok) {
        toast.success("Настройките са запазени.");
        router.refresh(); // пре-зарежда props-ите → dirty базата настига → формата „чиста"
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <CouponSection
        title="Welcome купон"
        hint="Нов абонат получава личен еднократен код при потвърждаване на абонамента (валиден 30 дни)."
        fields={welcome}
        error={fieldErrors.welcome}
        onChange={(f) => {
          setWelcome(f);
          if (fieldErrors.welcome) setFieldErrors((prev) => ({ ...prev, welcome: undefined }));
        }}
      />
      <CouponSection
        title="Реферален купон"
        hint="Абонатът получава код за приятел — многократен, за да води нови клиенти."
        fields={referral}
        error={fieldErrors.referral}
        onChange={(f) => {
          setReferral(f);
          if (fieldErrors.referral) setFieldErrors((prev) => ({ ...prev, referral: undefined }));
        }}
      />

      <div>
        <Button type="button" onClick={submit} disabled={pending || !dirty}>
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
  error,
  onChange,
}: {
  title: string;
  hint: string;
  fields: CouponFields;
  error?: string;
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
              error={error}
            />
          ) : (
            <PriceInput
              label="Отстъпка"
              value={fields.value}
              onChange={(e) => onChange({ ...fields, value: e.target.value })}
              error={error}
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
