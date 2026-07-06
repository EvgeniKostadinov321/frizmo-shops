"use client";

import Image from "next/image";
import { THEME_LABELS, THEME_META } from "@/lib/themes";
import type { Palette } from "@/lib/site-recipes";
import type { ThemeId } from "@/schemas/site-settings";

/**
 * Превю на тема за wizard-а: истински скрийншот на демо магазина на темата
 * (public/theme-previews/{theme}.jpg — регенерират се при редизайн, виж
 * README-то в папката) + палитра-точки, подсказващи, че цветовете са
 * сменяеми в следващата стъпка.
 */
export function ThemePreviewCard({
  theme,
  palette,
  active,
  onSelect,
  className = "",
}: {
  theme: ThemeId;
  palette: Palette;
  /** Името на магазина — за alt текста на превюто. */
  shopName?: string;
  active: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const meta = THEME_META[theme];

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`flex flex-col overflow-hidden rounded-card border-2 text-left transition-all ${
        active
          ? "border-brand-600 shadow-card"
          : "border-surface-200 hover:-translate-y-0.5 hover:border-surface-300 hover:shadow-card"
      } ${className}`}
    >
      <span className="relative block aspect-30/19 w-full bg-surface-100">
        <Image
          src={`/theme-previews/${theme}.jpg`}
          alt={`Как изглежда тема ${THEME_LABELS[theme]}`}
          fill
          sizes="(max-width: 640px) 100vw, 33vw"
          className="object-cover"
          draggable={false}
        />
        {/* Палитрата на темата — подсказка, че цветът се избира отделно */}
        <span className="absolute bottom-2 left-2 flex -space-x-1.5" aria-hidden>
          <span
            className="size-5 rounded-full border-2 border-white shadow-sm"
            style={{ background: palette.primary }}
          />
          <span
            className="size-5 rounded-full border-2 border-white shadow-sm"
            style={{ background: palette.accent }}
          />
        </span>
        {active && (
          <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-600 text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </span>
      {/* flex-1: етикетите изравняват височините на картите в реда */}
      <span className="flex flex-1 flex-col gap-0.5 border-t border-surface-200 bg-surface-0 px-3 py-2 lg:px-4 lg:py-3">
        <span className="text-sm font-semibold text-ink-900 lg:text-base">
          {THEME_LABELS[theme]}
        </span>
        <span className="text-xs leading-snug text-ink-600 lg:text-sm">{meta.tagline}</span>
      </span>
    </button>
  );
}
