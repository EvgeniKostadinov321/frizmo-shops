"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { subscribeStockAlert } from "@/actions/stock-alerts";

interface StockAlertFormProps {
  shopSlug: string;
  productId: string;
}

/** S14: „извести ме при наличност" — показва се само при изчерпан продукт. */
export function StockAlertForm({ shopSlug, productId }: StockAlertFormProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeStockAlert(shopSlug, { productId, email, website: "" });
      if (!result.ok) {
        setError(result.fieldErrors?.email ?? result.error);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4 text-sm text-(--sf-text)">
        <Icon name="check" size={18} className="shrink-0 text-(--sf-primary)" />
        Готово — ще получиш имейл, щом продуктът се върне в наличност.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4"
    >
      <p className="text-sm font-medium text-(--sf-text)">Извести ме при наличност</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="твоят имейл"
          aria-label="Имейл за известие при наличност"
          autoComplete="email"
          className="h-11 min-w-0 flex-1 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !email.trim()}
          className="h-11 rounded-(--sf-radius) bg-(--sf-primary) px-5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Записване…" : "Извести ме"}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
      <p className="text-xs text-(--sf-muted)">
        Един имейл, само когато се върне в наличност. Без абонамент.
      </p>
    </form>
  );
}
