"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { publicImageUrl } from "@/lib/storage";
import { SectionShell } from "../shared";
import type { CategoryVariantProps } from "./index";

/**
 * Вариант 2 — номериран списък-меню (editorial): гигантски редове
 * (01 · Керамика · 12 продукта →) с hairline разделители; hover/фокус
 * изплува снимката на категорията вдясно като плаваща картичка (мек fade,
 * лека ротация). МОБИЛНО-безопасен по рождение: редовете са самодостатъчни
 * (тап = навигация), снимката е десктоп бонус — нищо не се осакатява.
 * Работи с всякакъв брой и без нито една снимка.
 */
export function CategoryList({ data, ctx, tone }: CategoryVariantProps) {
  const [active, setActive] = useState(0);
  const selected =
    data.categoryIds.length > 0
      ? ctx.categories.filter((c) => data.categoryIds.includes(c.id))
      : ctx.categories.filter((c) => c.parentId === null).slice(0, 8);
  if (selected.length === 0) return null;

  const current = selected[Math.min(active, selected.length - 1)]!;
  const preview = ctx.categoryCovers[current.id]?.imagePath;

  const action = (
    <Link href={`${ctx.base}/products`} className="font-medium text-(--sf-primary) hover:opacity-75">
      Виж всички →
    </Link>
  );

  return (
    <SectionShell
      kicker="Колекции"
      title={data.title || "Разгледай по категория"}
      tone={tone}
      action={action}
    >
      <div className="relative">
        <ol className="flex flex-col lg:max-w-[calc(100%-20rem)]">
          {selected.map((category, i) => {
            const count = ctx.categoryCovers[category.id]?.productCount ?? 0;
            const countLabel =
              count > 0 ? `${count} ${count === 1 ? "продукт" : "продукта"}` : null;
            const isActive = i === active;
            return (
              <li key={category.id}>
                <Link
                  href={`${ctx.base}/products?category=${category.id}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`group flex items-baseline gap-5 border-b border-(--sf-border) py-5 transition-colors md:py-6 ${
                    isActive ? "border-(--sf-primary)" : ""
                  }`}
                >
                  <span
                    className={`text-[12px] font-bold tracking-[0.18em] transition-colors ${
                      isActive ? "text-(--sf-primary)" : "text-(--sf-muted)"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate font-(family-name:--sf-font-heading) text-[clamp(1.5rem,4vw,2.75rem)] leading-tight text-(--sf-text) transition-transform duration-300 ${
                      isActive ? "md:translate-x-1.5" : ""
                    }`}
                    style={{ fontWeight: "var(--sf-heading-weight)" }}
                    title={category.name}
                  >
                    {category.name}
                  </span>
                  {countLabel && (
                    <span className="hidden shrink-0 text-[11px] font-bold uppercase tracking-[0.18em] text-(--sf-muted) sm:block">
                      {countLabel}
                    </span>
                  )}
                  <span
                    aria-hidden
                    className={`shrink-0 text-xl text-(--sf-primary) transition-all duration-300 ${
                      isActive ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-40"
                    }`}
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>

        {/* Плаваща снимка-preview на активната категория (само десктоп).
            Височината следва списъка (inset-y) с таван — при малко редове
            снимката се смалява и НЕ стърчи към следващата секция. */}
        {preview && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-1 right-0 hidden items-center lg:flex"
          >
            <div
              key={current.id}
              className="sf-frame animate-fade-in relative aspect-4/5 h-full max-h-96 rotate-2 overflow-hidden rounded-(--sf-radius) shadow-(--sf-shadow)"
            >
              <Image
                src={publicImageUrl(preview)}
                alt=""
                fill
                sizes="18rem"
                className="object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
