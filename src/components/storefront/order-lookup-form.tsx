"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { lookupOrder } from "@/actions/orders";

interface OrderLookupFormProps {
  slug: string;
}

const inputClass =
  "h-11 w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3 text-(--sf-text) placeholder:text-(--sf-muted)";

export function OrderLookupForm({ slug }: OrderLookupFormProps) {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await lookupOrder(slug, { orderNumber, phone });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.data.path);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--sf-text)">Номер на поръчка</span>
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder="напр. 42"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-(--sf-text)">Телефон</span>
        <input
          className={inputClass}
          type="tel"
          autoComplete="tel"
          placeholder="напр. 0888 123 456"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </label>
      {error && (
        <span role="alert" className="text-sm text-(--sf-accent)">
          {error}
        </span>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="sf-cta h-12 rounded-(--sf-radius) bg-(--sf-primary) font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Проверявам…" : "Провери"}
      </button>
    </form>
  );
}
