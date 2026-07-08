"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui";
import { requestReturn } from "@/actions/orders";

interface ReturnRequestProps {
  shopSlug: string;
  orderId: string;
  token: string;
  returnWindowDays: number;
}

/** N12: купувачът заявява връщане от страницата на поръчката (token линка). */
export function ReturnRequest({ shopSlug, orderId, token, returnWindowDays }: ReturnRequestProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await requestReturn(shopSlug, { orderId, token, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 flex items-center gap-2.5 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4 text-sm text-(--sf-text)">
        <Icon name="check" size={18} className="shrink-0 text-(--sf-primary)" />
        Заявката за връщане е изпратена — магазинът ще я прегледа и ще получиш имейл.
      </div>
    );
  }

  if (!open) {
    return (
      <p className="mt-6 text-center text-sm text-(--sf-muted)">
        Промени решението си?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-(--sf-primary) underline hover:opacity-70"
        >
          Заяви връщане
        </button>{" "}
        (до {returnWindowDays} дни от завършването)
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-4"
    >
      <p className="font-medium text-(--sf-text)">Заявка за връщане</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Причина за връщането (по избор)"
        aria-label="Причина за връщането"
        className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) px-3.5 py-2.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-(--sf-radius) bg-(--sf-primary) px-5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Изпращане…" : "Изпрати заявката"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 rounded-(--sf-radius) border border-(--sf-border) px-5 text-sm text-(--sf-text) transition-colors hover:border-(--sf-primary)"
        >
          Отказ
        </button>
      </div>
    </form>
  );
}
