"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import { discountPercent } from "../../product-card";
import { SectionShell } from "../shared";
import type { FeaturedVariantProps } from "./index";

/**
 * Вариант 2 — Editorial списък: голяма снимка вляво (активният продукт),
 * вдясно номерирани редове (01 · име · hairline · цена). Hover/фокус върху
 * ред сменя снимката — бутиков „lookbook" патерн, коренно различен от grid-а.
 * На МОБИЛНО hover няма (тапът навигира) → същият вариант се превъплъщава в
 * swipe слайдър с едри слайдове (снимка + име·цена) — нативният жест на
 * телефона поема ролята на hover-а.
 */
export function FeaturedEditorial({ data, products, ctx, tone }: FeaturedVariantProps) {
  const [active, setActive] = useState(0);
  if (products.length === 0) return null;
  const current = products[Math.min(active, products.length - 1)]!;
  const cover = current.images[0];

  const action = (
    <Link href={`${ctx.base}/products`} className="font-medium text-(--sf-primary) hover:opacity-75">
      Виж всички →
    </Link>
  );

  return (
    <SectionShell
      kicker="Магазин"
      title={data.title || "Избрани продукти"}
      tone={tone}
      action={action}
    >
      {/* МОБИЛНО (< md): swipe слайдър — едри слайдове, скролът е жестът */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none md:hidden [&::-webkit-scrollbar]:hidden">
        {products.map((product, i) => {
          const slideCover = product.images[0];
          const promo = product.promoPriceCents;
          return (
            <Link
              key={product.id}
              href={`${ctx.base}/p/${product.slug}`}
              className="w-[78%] shrink-0 snap-center"
            >
              <span className="sf-frame relative block aspect-4/5 overflow-hidden rounded-(--sf-radius) bg-(--sf-surface-raised) shadow-(--sf-shadow)">
                {slideCover ? (
                  <Image
                    src={publicImageUrl(slideCover)}
                    alt={product.name}
                    fill
                    sizes="78vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center" aria-hidden>
                    <Icon name="image" size={40} className="text-(--sf-muted) opacity-40" />
                  </span>
                )}
                {promo !== null && (
                  <span className="absolute left-3 top-3 rounded-full bg-(--sf-accent) px-2.5 py-1 text-xs font-bold text-(--sf-on-accent)">
                    −{discountPercent(product.priceCents, promo)}%
                  </span>
                )}
              </span>
              <span className="mt-3 flex items-baseline gap-3">
                <span className="text-[11px] font-bold tracking-[0.18em] text-(--sf-muted)">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-(--sf-text)" title={product.name}>
                  {product.name}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  {promo !== null && (
                    <s className="text-sm text-(--sf-muted)">{formatPrice(product.priceCents)}</s>
                  )}
                  <span className="font-bold text-(--sf-text)">
                    {formatPrice(promo ?? product.priceCents)}
                  </span>
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      {/* ДЕСКТОП (md+): hover списък до голямата снимка */}
      <div className="hidden items-start gap-8 md:grid md:grid-cols-[5fr_6fr] md:gap-12">
        {/* Снимката на активния продукт — сменя се с мек fade */}
        <Link
          href={`${ctx.base}/p/${current.slug}`}
          className="group relative block overflow-hidden rounded-(--sf-radius) bg-(--sf-surface-raised) shadow-(--sf-shadow)"
        >
          <span className="sf-frame relative block aspect-4/5">
            {cover ? (
              <Image
                key={current.id}
                src={publicImageUrl(cover)}
                alt={current.name}
                fill
                sizes="(max-width: 768px) 100vw, 40vw"
                className="animate-fade-in object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <span className="flex size-full items-center justify-center" aria-hidden>
                <Icon name="image" size={56} className="text-(--sf-muted) opacity-40" />
              </span>
            )}
          </span>
          {current.promoPriceCents !== null && (
            <span className="absolute left-3 top-3 rounded-full bg-(--sf-accent) px-2.5 py-1 text-xs font-bold text-(--sf-on-accent)">
              −{discountPercent(current.priceCents, current.promoPriceCents)}%
            </span>
          )}
        </Link>

        {/* Номерирани редове — hover/фокус превключва снимката */}
        <ol className="flex flex-col">
          {products.map((product, i) => {
            const promo = product.promoPriceCents;
            const isActive = i === active;
            return (
              <li key={product.id}>
                <Link
                  href={`${ctx.base}/p/${product.slug}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`group flex items-baseline gap-4 border-b border-(--sf-border) py-4 transition-colors md:py-5 ${
                    isActive ? "border-(--sf-primary)" : ""
                  }`}
                >
                  <span
                    className={`text-[11px] font-bold tracking-[0.18em] transition-colors ${
                      isActive ? "text-(--sf-primary)" : "text-(--sf-muted)"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-lg leading-snug transition-transform duration-300 md:text-xl ${
                      isActive ? "translate-x-1 text-(--sf-text)" : "text-(--sf-text)"
                    }`}
                    title={product.name}
                  >
                    {product.name}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {promo !== null && (
                      <s className="text-sm text-(--sf-muted)">{formatPrice(product.priceCents)}</s>
                    )}
                    <span className="text-lg font-bold text-(--sf-text)">
                      {formatPrice(promo ?? product.priceCents)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`hidden text-(--sf-primary) transition-all duration-300 md:block ${
                      isActive ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0"
                    }`}
                  >
                    →
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </SectionShell>
  );
}
