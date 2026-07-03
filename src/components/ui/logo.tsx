import Link from "next/link";

type LogoProps = {
  /** Накъде води кликът; null = без линк (декоративно). */
  href?: string | null;
  /** Размер на знака в px. */
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

/**
 * Знакът на Frizmo Shops: пазарска чанта с ember точка (поръчка) върху
 * тъмен закръглен квадрат. Рисуван на ръка — единственото лого в UI-я.
 */
function LogoMark({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-control bg-ink-900 text-surface-50"
      style={{ width: size, height: size }}
    >
      <svg
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Тяло на чантата */}
        <path d="M5.5 9.5 h13 l-1 9.2 a1.8 1.8 0 0 1 -1.8 1.6 H8.3 a1.8 1.8 0 0 1 -1.8 -1.6 Z" />
        {/* Дръжка */}
        <path d="M9 9.5 V7.2 a3 3 0 0 1 6 0 V9.5" />
        {/* Ember точка — „нова поръчка" */}
        <circle cx="12" cy="14.8" r="1.6" fill="var(--color-ember-500)" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", size = 32, withWordmark = true, className }: LogoProps) {
  const content = (
    <>
      <LogoMark size={size} />
      {withWordmark && (
        <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-ink-900">
          Frizmo <span className="text-ember-500">Shops</span>
        </span>
      )}
    </>
  );

  const classes = `flex items-center gap-2 ${className ?? ""}`;
  if (href === null) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} aria-label="Frizmo Shops — начало" className={classes}>
      {content}
    </Link>
  );
}
