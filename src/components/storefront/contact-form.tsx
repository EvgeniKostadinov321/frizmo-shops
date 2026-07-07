"use client";

import { cloneElement, useRef, useState } from "react";
import { sendContactMessage } from "@/actions/contact";

const inputClass =
  "h-11 w-full rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) px-3 text-(--sf-text) placeholder:text-(--sf-muted) focus:border-(--sf-primary) focus:outline-none";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactElement<{ "aria-invalid"?: boolean }>;
}) {
  const control = error ? cloneElement(children, { "aria-invalid": true }) : children;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-(--sf-text)">{label}</span>
      {control}
      {error && (
        <span role="alert" className="text-sm text-(--sf-accent)">
          {error}
        </span>
      )}
    </label>
  );
}

/**
 * Публична контактна форма на страница „Контакти". Изпраща имейл до търговеца
 * (без запис в базата). Показва се само ако магазинът има имейл.
 */
export function ContactForm({ slug }: { slug: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await sendContactMessage(slug, { name, email, message, website });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.error);
        queueMicrotask(() =>
          formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
        );
        return;
      }
      setSent(true);
      setName("");
      setEmail("");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface) p-6 text-center">
        <p className="font-(family-name:--sf-font-heading) text-xl text-(--sf-text)">
          Съобщението е изпратено!
        </p>
        <p className="mt-1.5 text-(--sf-muted)">Ще ти отговорим възможно най-скоро.</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Име" error={fieldErrors.name}>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Имейл" error={fieldErrors.email}>
        <input
          type="email"
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label="Съобщение" error={fieldErrors.message}>
        <textarea
          className={`${inputClass} h-32 resize-y py-2.5`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      {/* Honeypot — скрит от хора, ботовете го попълват. */}
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

      {error && (
        <p role="alert" className="text-sm text-(--sf-accent)">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="sf-cta inline-flex h-12 items-center justify-center rounded-(--sf-radius) bg-(--sf-primary) px-7 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Изпращане…" : "Изпрати съобщение"}
      </button>
    </form>
  );
}
