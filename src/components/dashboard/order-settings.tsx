"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { saveOrderSettings } from "@/actions/fulfillment";
import { Button, Checkbox, PriceInput, Select } from "@/components/ui";
import { centsToInput } from "@/lib/money";

interface OrderSettingsProps {
  giftWrapEnabled: boolean;
  giftWrapFeeCents: number;
  giftCardEnabled: boolean;
  returnWindowDays: number;
}

/** N9+N12: подаръчна опаковка (toggle + такса) + картичка (toggle) и срок за връщане (14/30/45). */
export function OrderSettings({
  giftWrapEnabled,
  giftWrapFeeCents,
  giftCardEnabled,
  returnWindowDays,
}: OrderSettingsProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(giftWrapEnabled);
  const [fee, setFee] = useState(giftWrapFeeCents > 0 ? centsToInput(giftWrapFeeCents) : "");
  const [cardEnabled, setCardEnabled] = useState(giftCardEnabled);
  const [windowDays, setWindowDays] = useState(String(returnWindowDays));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      const result = await saveOrderSettings({
        giftWrapEnabled: enabled,
        giftWrapFee: fee,
        giftCardEnabled: cardEnabled,
        returnWindowDays: Number(windowDays),
      });
      if (!result.ok) toast.error(result.error);
      else toast.success("Настройките са запазени.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-surface-200 bg-surface-0 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-900">Поръчки и връщания</h2>
        <p className="mt-1 text-sm text-ink-500">
          Подаръчни опции в checkout-а и срок, в който клиентът може да заяви връщане.
        </p>
      </div>

      {/* Подаръчни опции — групирани заедно, отделени с hairline от връщането. */}
      <div className="flex flex-col gap-3 border-t border-surface-100 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500">
          Подаръчни опции
        </p>
        <Checkbox
          label="Предлагам подаръчна опаковка"
          hint="Клиентът може да заяви опаковане на поръчката в подаръчна хартия (със или без такса)."
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {enabled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-8">
            <div className="w-40">
              <PriceInput
                label="Такса за опаковка"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
            <p className="mt-5 text-sm text-ink-500">Остави празно за безплатна.</p>
          </div>
        )}
        <Checkbox
          label="Предлагам подаръчна картичка"
          hint="Клиентът може да добави текст поздрав към поръчката. Безплатно."
          checked={cardEnabled}
          onChange={(e) => setCardEnabled(e.target.checked)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-surface-100 pt-4">
        <div className="w-52">
          <Select
            label="Срок за заявка на връщане"
            options={[
              { value: "14", label: "14 дни" },
              { value: "30", label: "30 дни" },
              { value: "45", label: "45 дни" },
            ]}
            value={windowDays}
            onChange={(e) => setWindowDays(e.target.value)}
          />
        </div>
        <p className="mt-5 text-sm text-ink-500">
          Брои се от завършването на поръчката. Законовият минимум е 14 дни.
        </p>
      </div>

      <div>
        <Button loading={busy} onClick={handleSave}>
          Запази настройките
        </Button>
      </div>
    </section>
  );
}
