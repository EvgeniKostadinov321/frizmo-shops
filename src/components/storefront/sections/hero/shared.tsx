import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { safeHref } from "@/lib/safe-url";
import type { SectionOfType } from "@/schemas/site-settings";
import type { SectionContext } from "../index";

export interface HeroVariantProps {
  data: SectionOfType<"hero">["data"];
  ctx: SectionContext;
}

/** Стъпка от оркестрираното зареждане (sf-rise + пореден номер). */
export const stagger = (step: number) => ({ "--sf-stagger": step }) as CSSProperties;

/** Primary CTA — винаги има (hero без действие е пропусната продажба). */
export function HeroCta({
  label,
  href,
  base,
  large = false,
}: {
  label: string;
  href: string;
  base: string;
  large?: boolean;
}) {
  return (
    <Link
      href={safeHref(href) || `${base}/products`}
      className={`sf-cta inline-flex items-center rounded-(--sf-radius) bg-(--sf-primary) font-medium text-(--sf-on-primary) transition-all hover:opacity-90 hover:shadow-lg ${
        large ? "h-14 px-9 text-lg" : "h-12 px-7"
      }`}
    >
      {label || "Разгледай продуктите"}
    </Link>
  );
}

/** Секундерно действие до CTA-то — тих текстов линк към историята.
 *  `show=false` (settings.showStoryLink) → не се рендерира. */
export function HeroSecondary({
  base,
  light = false,
  show = true,
}: {
  base: string;
  light?: boolean;
  show?: boolean;
}) {
  if (!show) return null;
  return (
    <Link
      href={`${base}/about`}
      className={`inline-flex h-14 items-center gap-1 font-medium underline-offset-4 transition-opacity hover:underline hover:opacity-80 ${
        light ? "text-white/90" : "text-(--sf-text)"
      }`}
    >
      Нашата история →
    </Link>
  );
}

/** Kicker над заглавието: „КЕРАМИЧНО АТЕЛИЕ · ПЛОВДИВ" — контекст с един поглед. */
export function HeroKicker({
  category,
  city,
  light = false,
}: {
  category: string;
  city: string | null;
  light?: boolean;
}) {
  const parts = [category, city].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    /* nowrap само от sm: нагоре — на 320–375px дълга категория иначе
       създава хоризонтален overflow на цялата страница (R1 от одита). */
    <p
      className={`text-pretty text-[12px] font-bold uppercase tracking-[0.24em] sm:whitespace-nowrap ${
        light ? "text-(--sf-accent-ink-dark)" : "text-(--sf-primary)"
      }`}
    >
      {parts.join(" · ")}
    </p>
  );
}

/**
 * Заглавие с акцентна дума: последната дума получава акцентния цвят
 * (изчислено четим — --sf-accent-ink/-dark) и темовия стил (italic при сериф).
 */
export function AccentTitle({
  title,
  dark = false,
  className,
  accent = true,
}: {
  title: string;
  dark?: boolean;
  className: string;
  /** false (settings.accentLastWord) → цялото заглавие в основния цвят. */
  accent?: boolean;
}) {
  /* break-words: защита срещу еднословни дълги имена, които не могат да се
     пренесат при min стойността на clamp-а на тесен екран (R5 от одита). */
  const words = title.trim().split(/\s+/);
  if (!accent || words.length < 2)
    return <h1 className={`wrap-break-word ${className}`}>{title}</h1>;
  const lastWord = words[words.length - 1];
  return (
    <h1 className={`wrap-break-word ${className}`}>
      {words.slice(0, -1).join(" ")}{" "}
      <span
        className={`[font-style:var(--sf-title-accent-style)] ${
          dark ? "text-(--sf-accent-ink-dark)" : "text-(--sf-accent-ink)"
        }`}
      >
        {lastWord}
      </span>
    </h1>
  );
}

/** Гигантска темова буква зад текста — дълбочина без риск за четимостта. */
export function Watermark({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -left-10 top-1/2 hidden -translate-y-1/2 select-none text-[24rem] leading-none opacity-[0.05] [font-family:var(--sf-font-heading)] [font-weight:var(--sf-heading-weight)] md:block"
    >
      {letter}
    </span>
  );
}

/** Стрелка надолу — подсказва, че има още (не при reduced-motion). */
export function ScrollCue({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute opacity-70 motion-safe:animate-bounce ${
        className ?? "bottom-6 left-1/2 -translate-x-1/2"
      }`}
    >
      <Icon name="chevron-down" size={28} />
    </div>
  );
}
