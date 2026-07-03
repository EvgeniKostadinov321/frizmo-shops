import Link from "next/link";
import { Icon } from "./icon";

type LogoProps = {
  /** Накъде води кликът; null = без линк (декоративно). */
  href?: string | null;
  /** Размер на знака в px. */
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

/**
 * Логото на Frizmo Shops: „store" знак в закръглен brand квадрат + wordmark.
 * Единственото място, откъдето UI-ят взима лого — без повторени „FS" квадрати.
 */
export function Logo({ href = "/", size = 32, withWordmark = true, className }: LogoProps) {
  const content = (
    <>
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-control bg-brand-600 text-white"
        style={{ width: size, height: size }}
      >
        <Icon name="store" size={Math.round(size * 0.58)} />
      </span>
      {withWordmark && (
        <span className="whitespace-nowrap text-lg font-bold tracking-tight text-ink-900">
          Frizmo <span className="text-brand-600">Shops</span>
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
