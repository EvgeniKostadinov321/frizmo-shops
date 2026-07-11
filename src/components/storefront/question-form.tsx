"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";
import { submitQuestion } from "@/actions/questions";

/** Публична форма за въпрос — влиза pending до отговор от магазина. */
export function QuestionForm({ shopSlug, productId }: { shopSlug: string; productId: string }) {
  const [askerName, setAskerName] = useState("");
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await submitQuestion(shopSlug, { productId, askerName, question, website: "" });
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
        Благодарим! Въпросът ти ще се публикува след отговор от магазина.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) p-4"
    >
      <p className="font-medium text-(--sf-text)">Задай въпрос</p>
      <input
        type="text"
        maxLength={60}
        value={askerName}
        onChange={(e) => setAskerName(e.target.value)}
        placeholder="Твоето име (по избор)"
        aria-label="Твоето име (по избор)"
        autoComplete="name"
        className="h-11 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        maxLength={500}
        minLength={5}
        required
        rows={3}
        placeholder="Какво искаш да попиташ за този продукт?"
        aria-label="Твоят въпрос"
        className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3.5 py-2.5 text-sm text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
      />
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="h-11 self-start rounded-(--sf-radius) bg-(--sf-primary) px-5 text-sm font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Изпращане…" : "Изпрати въпрос"}
      </button>
      <p className="text-xs text-(--sf-muted)">Въпросът се публикува след отговор от магазина.</p>
    </form>
  );
}
