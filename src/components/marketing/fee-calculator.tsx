"use client";

import { useId, useState } from "react";
import { FEE_CAP_CENTS, FEE_MIN_CENTS, feeCents } from "@/lib/fee";
import { formatPrice } from "@/lib/money";

/*
 * „Касова бележка" — интерактивният калкулатор на таксата (5%, мин 0,30 €,
 * таван 50 €). Прозрачността на модела, направена осезаема: местиш слайдера,
 * бележката се „отпечатва" наново. Смятането е през ЕДИНСТВЕНИЯ източник
 * src/lib/fee.ts — никаква втора аритметика тук.
 */

/** Ред от бележката: етикет вляво, водещи точки, моно стойност вдясно. */
function ReceiptLine({
  label,
  value,
  strong = false,
  accent = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`shrink-0 text-sm ${strong ? "font-bold text-ink-900" : "text-ink-700"}`}>
        {label}
      </span>
      <span aria-hidden className="min-w-4 flex-1 border-b border-dotted border-surface-300" />
      <span
        className={`shrink-0 font-mono text-sm tabular-nums ${
          strong ? "text-base font-bold" : ""
        } ${accent ? "text-brand-600" : "text-ink-900"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function FeeCalculator() {
  const sliderId = useId();
  /* Слайдерът работи в цели евро (10–1 000 €) — вътрешно всичко е в центове. */
  const [saleEuros, setSaleEuros] = useState(120);
  const saleCents = saleEuros * 100;
  const fee = feeCents(saleCents);
  const keep = saleCents - fee;
  const atMin = fee === FEE_MIN_CENTS && Math.round(saleCents * 0.05) < FEE_MIN_CENTS;
  const atCap = fee === FEE_CAP_CENTS;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Бележката — „хартийка" с перфориран горен и долен ръб */}
      <div
        className="relative bg-surface-0 px-6 py-6 shadow-card"
        style={{
          clipPath:
            "polygon(0 6px, 2% 0, 4% 6px, 6% 0, 8% 6px, 10% 0, 12% 6px, 14% 0, 16% 6px, 18% 0, 20% 6px, 22% 0, 24% 6px, 26% 0, 28% 6px, 30% 0, 32% 6px, 34% 0, 36% 6px, 38% 0, 40% 6px, 42% 0, 44% 6px, 46% 0, 48% 6px, 50% 0, 52% 6px, 54% 0, 56% 6px, 58% 0, 60% 6px, 62% 0, 64% 6px, 66% 0, 68% 6px, 70% 0, 72% 6px, 74% 0, 76% 6px, 78% 0, 80% 6px, 82% 0, 84% 6px, 86% 0, 88% 6px, 90% 0, 92% 6px, 94% 0, 96% 6px, 98% 0, 100% 6px, 100% calc(100% - 6px), 98% 100%, 96% calc(100% - 6px), 94% 100%, 92% calc(100% - 6px), 90% 100%, 88% calc(100% - 6px), 86% 100%, 84% calc(100% - 6px), 82% 100%, 80% calc(100% - 6px), 78% 100%, 76% calc(100% - 6px), 74% 100%, 72% calc(100% - 6px), 70% 100%, 68% calc(100% - 6px), 66% 100%, 64% calc(100% - 6px), 62% 100%, 60% calc(100% - 6px), 58% 100%, 56% calc(100% - 6px), 54% 100%, 52% calc(100% - 6px), 50% 100%, 48% calc(100% - 6px), 46% 100%, 44% calc(100% - 6px), 42% 100%, 40% calc(100% - 6px), 38% 100%, 36% calc(100% - 6px), 34% 100%, 32% calc(100% - 6px), 30% 100%, 28% calc(100% - 6px), 26% 100%, 24% calc(100% - 6px), 22% 100%, 20% calc(100% - 6px), 18% 100%, 16% calc(100% - 6px), 14% 100%, 12% calc(100% - 6px), 10% 100%, 8% calc(100% - 6px), 6% 100%, 4% calc(100% - 6px), 2% 100%, 0 calc(100% - 6px))",
        }}
      >
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
          Frizmo Shops · Бележка
        </p>
        <div aria-hidden className="my-4 border-t border-dashed border-surface-300" />

        <div aria-live="polite" className="flex flex-col gap-3">
          <ReceiptLine label="Твоя продажба" value={formatPrice(saleCents)} />
          <ReceiptLine label="Такса Frizmo (5%)" value={`−${formatPrice(fee)}`} accent />
          <div aria-hidden className="border-t border-dashed border-surface-300" />
          <ReceiptLine label="Получаваш" value={formatPrice(keep)} strong />
        </div>

        {(atMin || atCap) && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-1.5 text-center text-[11px] font-medium text-brand-700">
            {atMin ? "Приложен е минимумът от 0,30 € на поръчка" : "Достигнат е таванът от 50 € — нагоре е само за теб"}
          </p>
        )}

        <div aria-hidden className="my-4 border-t border-dashed border-surface-300" />
        <p className="text-center text-[11px] text-ink-500">Без месечен абонамент · Благодарим ти!</p>
      </div>

      {/* Слайдерът под бележката */}
      <div className="mt-6">
        <label htmlFor={sliderId} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium text-ink-700">
          Премести и виж сметката
          <span className="font-mono text-base font-bold tabular-nums text-ink-900">
            {formatPrice(saleCents)}
          </span>
        </label>
        <input
          id={sliderId}
          type="range"
          min={5}
          max={1000}
          step={5}
          value={saleEuros}
          onChange={(e) => setSaleEuros(Number(e.target.value))}
          className="mt-2 h-11 w-full cursor-pointer accent-brand-600"
        />
        <div aria-hidden className="flex justify-between text-xs text-ink-500">
          <span>5 €</span>
          <span>1 000 €</span>
        </div>
      </div>
    </div>
  );
}
