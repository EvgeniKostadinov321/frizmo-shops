import type { ReactNode } from "react";

/** Обвивка на секция с еднакви отстояния и опционално заглавие. */
export function SectionShell({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-4 py-10 ${className}`}>
      {title && (
        <h2
          className="mb-6 text-2xl text-(--sf-text)"
          style={{ fontWeight: "var(--sf-heading-weight)" as never }}
        >
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

/** Plain text → параграфи (редовете са единственото форматиране в MVP). */
export function Paragraphs({ text, className = "" }: { text: string; className?: string }) {
  const parts = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {parts.map((part, i) => (
        <p key={i} className={`whitespace-pre-line ${className}`}>
          {part}
        </p>
      ))}
    </>
  );
}
