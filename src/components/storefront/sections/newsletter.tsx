"use client";

import { useState } from "react";
import { subscribeToNewsletter } from "@/actions/newsletter";
import type { SectionOfType } from "@/schemas/site-settings";
import { SectionShell, type SectionTone } from "./shared";
import type { SectionContext } from "./index";

/**
 * Нюзлетър секция: заглавие + текст + поле за имейл (double opt-in). Клиентът
 * получава потвърждаващ имейл; едва след клик влиза в списъка на търговеца.
 */
export function NewsletterSection({
  data,
  ctx,
  tone,
}: {
  data: SectionOfType<"newsletter">["data"];
  ctx: SectionContext;
  tone?: SectionTone;
}) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | "sent" | "already">(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await subscribeToNewsletter(ctx.shop.slug, { email, website });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.data.alreadyConfirmed ? "already" : "sent");
      setEmail("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SectionShell tone={tone} titleHidden>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <span aria-hidden className="h-0.5 w-10 bg-(--sf-primary)" />
          <h2 className="text-[clamp(1.5rem,3vw,2.25rem)] leading-tight text-(--sf-text)">
            {data.title || "Абонирай се за новини"}
          </h2>
          {data.text && <p className="text-(--sf-muted)">{data.text}</p>}
        </div>

        {done === "sent" ? (
          <p className="text-(--sf-text)">
            Проверй пощата си — изпратихме ти линк за потвърждение.
          </p>
        ) : done === "already" ? (
          <p className="text-(--sf-text)">Вече си абониран. Благодарим!</p>
        ) : (
          <form onSubmit={submit} noValidate className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="твоят@имейл.com"
              autoComplete="email"
              className="h-12 flex-1 rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-4 text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none"
            />
            {/* Honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute left-[-9999px] size-0"
            />
            <button
              type="submit"
              disabled={submitting}
              className="sf-cta inline-flex h-12 shrink-0 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) px-6 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "…" : "Абонирай се"}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-(--sf-accent)">{error}</p>}
        {!done && (
          <p className="text-xs text-(--sf-muted)">Без спам. Отписваш се по всяко време.</p>
        )}
      </div>
    </SectionShell>
  );
}
