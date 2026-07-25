"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon } from "@/components/ui";

/*
 * Живата демонстрация на „целият сайт се преоцветява с един клик":
 * посетителят избира палитра → мини-магазинът се преоцветява пред очите му.
 * Палитрите са ДЕМО СЪДЪРЖАНИЕ (мостри в духа на storefront темите), не
 * платформени токени — затова живеят тук като данни, а не в tokens.css.
 */
const PALETTES = [
  { id: "terra", name: "Теракота", accent: "#9a5717", soft: "#f3e0c9", ink: "#2b2018" },
  { id: "forest", name: "Гора", accent: "#14665a", soft: "#dcece7", ink: "#122622" },
  { id: "plum", name: "Слива", accent: "#7c3f58", soft: "#f0dfe6", ink: "#2a1b22" },
  { id: "night", name: "Нощ", accent: "#22303d", soft: "#e2e8ee", ink: "#141c24" },
] as const;

export function ThemeRecolorDemo() {
  const [active, setActive] = useState<(typeof PALETTES)[number]>(PALETTES[0]);

  return (
    <div className="w-full max-w-sm">
      {/* Мини магазинът — чете само CSS променливите отдолу */}
      <div
        style={{
          "--demo-accent": active.accent,
          "--demo-soft": active.soft,
          "--demo-ink": active.ink,
        } as React.CSSProperties}
        className="overflow-hidden rounded-card border border-surface-200 bg-surface-0 shadow-float"
      >
        {/* Header на магазина в акцентния цвят */}
        <div
          className="flex items-center justify-between px-4 py-3 transition-colors duration-500"
          style={{ backgroundColor: "var(--demo-soft)" }}
        >
          <span
            className="font-display text-sm font-extrabold transition-colors duration-500"
            style={{ color: "var(--demo-ink)" }}
          >
            Ателие Ръчичка
          </span>
          <span
            className="flex size-7 items-center justify-center rounded-full text-white transition-colors duration-500"
            style={{ backgroundColor: "var(--demo-accent)" }}
          >
            <Icon name="store" size={13} />
          </span>
        </div>
        {/* Продукт + CTA */}
        <div className="flex items-center gap-3 p-4">
          <Image
            src="/landing/hero-mug.webp"
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-900">Керамична чаша „Есен“</p>
            <p className="text-[13px] font-bold text-ink-900">34,00 €</p>
          </div>
          <span
            className="rounded-full px-3.5 py-2 text-xs font-bold text-white transition-colors duration-500"
            style={{ backgroundColor: "var(--demo-accent)" }}
          >
            Купи
          </span>
        </div>
        {/* Промо лента в мекия тон */}
        <div
          className="px-4 py-2 text-center text-[11px] font-semibold transition-colors duration-500"
          style={{ backgroundColor: "var(--demo-soft)", color: "var(--demo-ink)" }}
        >
          Безплатна доставка над 60 €
        </div>
      </div>

      {/* Палитрите — истинските контроли на демонстрацията */}
      <div className="mt-4 flex items-center justify-center gap-3" role="group" aria-label="Избери палитра на демо магазина">
        {PALETTES.map((palette) => (
          <button
            key={palette.id}
            type="button"
            onClick={() => setActive(palette)}
            aria-pressed={active.id === palette.id}
            aria-label={`Палитра ${palette.name}`}
            className={`flex size-11 items-center justify-center rounded-full transition-all ${
              active.id === palette.id
                ? "ring-2 ring-ink-900 ring-offset-2 ring-offset-surface-0"
                : "hover:scale-110"
            }`}
          >
            <span
              aria-hidden
              className="size-7 rounded-full border border-ink-900/10"
              style={{ backgroundColor: palette.accent }}
            />
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-ink-500">
        Пробвай: <span className="font-bold text-ink-700">{active.name}</span> — един клик, цял нов магазин
      </p>
    </div>
  );
}
