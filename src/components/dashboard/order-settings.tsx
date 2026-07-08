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
  returnWindowDays: number;
}

/** N9+N12: подаръчна опаковка (toggle + такса) и срок за връщане (14/30/45). */
export function OrderSettings({ giftWrapEnabled, giftWrapFeeCents, returnWindowDays }: OrderSettingsProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(giftWrapEnabled);
  const [fee, setFee] = useState(giftWrapFeeCents > 0 ? centsToInput(giftWrapFeeCents) : "");
  const [windowDays, setWindowDays] = useState(String(returnWindowDays));
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      const result = await saveOrderSettings({
        giftWrapEnabled: enabled,
        giftWrapFee: fee,
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
          Подаръчна опаковка в checkout-а и срок, в който клиентът може да заяви връщане.
        </p>
      </div>

      <Checkbox
        label="Предлагам подаръчна опаковка"
        hint="Клиентът вижда чекбокс + поле за картичка при поръчка."
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
      />
      {enabled && (
        <div className="max-w-48">
          <PriceInput
            label="Такса за опаковка"
            hint="Остави празно за безплатна."
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
      )}

      <div className="max-w-64">
        <Select
          label="Срок за заявка на връщане"
          hint="Брои се от завършването на поръчката. Законовият минимум е 14 дни."
          options={[
            { value: "14", label: "14 дни" },
            { value: "30", label: "30 дни" },
            { value: "45", label: "45 дни" },
          ]}
          value={windowDays}
          onChange={(e) => setWindowDays(e.target.value)}
        />
      </div>

      <div>
        <Button loading={busy} onClick={handleSave}>
          Запази настройките
        </Button>
      </div>
    </section>
  );
}
