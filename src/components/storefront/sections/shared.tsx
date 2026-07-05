import type { ReactNode } from "react";

/** Тон на секцията: default = фон на страницата; surface = пълноширока лента
 *  в --sf-surface (редуването дава вертикален ритъм между секциите). */
export type SectionTone = "default" | "surface";

/**
 * Обвивка на секция: editorial заглавен блок (kicker + clamp заглавие + опц.
 * интро + опц. action вдясно) върху пълноширок тонален фон.
 * `titleHidden` = секцията рендерира собственото си заглавие.
 */
export function SectionShell({
  kicker,
  title,
  intro,
  action,
  tone = "default",
  titleHidden = false,
  children,
  className = "",
}: {
  /** Малка uppercase дума над заглавието (напр. „Магазин", „Отзиви"). */
  kicker?: string;
  title?: string;
  /** Кратко интро изречение под заглавието. */
  intro?: string;
  /** Действие вдясно от заглавието (напр. линк „Виж всички →"). */
  action?: ReactNode;
  tone?: SectionTone;
  titleHidden?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    /* surface + wash: едва доловим вертикален градиент (ефект A) — само при
       темите с --sf-surface-wash ≠ none (меките). */
    <section
      className={
        tone === "surface" ? "bg-(--sf-surface) [background-image:var(--sf-surface-wash)]" : ""
      }
    >
      <div className={`mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 ${className}`}>
        {(title || kicker) && !titleHidden && (
          <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="max-w-2xl">
              {kicker && (
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
                  {kicker}
                </p>
              )}
              {title && (
                <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.1] text-(--sf-text)">
                  {title}
                </h2>
              )}
              {intro && <p className="mt-3 text-(--sf-muted)">{intro}</p>}
            </div>
            {action && <div className="shrink-0 pb-1">{action}</div>}
          </div>
        )}
        {children}
      </div>
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
