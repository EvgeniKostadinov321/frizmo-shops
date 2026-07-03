import Image from "next/image";
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
 * Логото на Frizmo Shops: пазарска чанта с „FS" монограм и ember точка
 * („нова поръчка") върху тъмен tile. Единственото място за логото в UI-я.
 */
export function Logo({ href = "/", size = 32, withWordmark = true, className }: LogoProps) {
  const content = (
    <>
      <Image
        src="/logo-mark.png"
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[22%]"
        priority
      />
      {withWordmark && (
        <span className="whitespace-nowrap font-display text-lg font-extrabold tracking-tight text-ink-900">
          Frizmo <span className="text-ember-500">Shops</span>
        </span>
      )}
    </>
  );

  const classes = `flex items-center gap-2.5 ${className ?? ""}`;
  if (href === null) return <span className={classes}>{content}</span>;
  return (
    <Link href={href} aria-label="Frizmo Shops — начало" className={classes}>
      {content}
    </Link>
  );
}
