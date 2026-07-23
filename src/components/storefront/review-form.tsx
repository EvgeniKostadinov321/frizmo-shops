"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { submitReview } from "@/actions/reviews";

/** S1: публична форма за ревю — влиза като pending до одобрение от магазина. */
export function ReviewForm({ shopSlug, productId }: { shopSlug: string; productId: string }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Избери оценка (звезди).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitReview(shopSlug, {
        productId,
        authorName,
        rating,
        text,
        phone,
        website: "",
      });
      if (!result.ok) {
        setError(result.fieldErrors ? Object.values(result.fieldErrors)[0]! : result.error);
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
        Благодарим! Ревюто ти чака одобрение от магазина.
      </div>
    );
  }

  const shown = hovered || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4"
    >
      <p className="font-medium text-(--sf-text)">Напиши ревю</p>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Оценка от 1 до 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} от 5`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            className={`flex size-11 items-center justify-center transition-transform hover:scale-110 ${
              n <= shown ? "text-(--sf-primary)" : "text-(--sf-muted) opacity-40"
            }`}
          >
            <Icon name="star" size={26} className={n <= shown ? "fill-current" : ""} />
          </button>
        ))}
      </div>

      <input
        type="text"
        required
        minLength={2}
        maxLength={60}
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Твоето име"
        aria-label="Твоето име"
        autoComplete="name"
        className="h-11 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Сподели впечатленията си (по избор)"
        aria-label="Текст на ревюто"
        className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />

      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        maxLength={30}
        placeholder="Телефон (по избор — за бадж Потвърдена покупка)"
        aria-label="Телефон (по избор)"
        autoComplete="tel"
        className="h-11 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />

      {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="h-11 self-start rounded-(--sf-radius) bg-(--sf-primary) px-5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Изпращане…" : "Изпрати ревю"}
      </button>
      <p className="text-xs text-(--sf-muted)">Ревюто се публикува след одобрение от магазина.</p>
    </form>
  );
}
