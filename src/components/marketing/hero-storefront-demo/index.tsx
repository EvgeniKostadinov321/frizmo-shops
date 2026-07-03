"use client";

import { m } from "motion/react";
import { Icon } from "@/components/ui";
import type { Product, Shop } from "@/db";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { formatPrice } from "@/lib/money";
import { publicImageUrl } from "@/lib/storage";
import { BrowserChrome } from "./browser-chrome";
import { MiniProductCard } from "./mini-product-card";
import { MiniShopHeader } from "./mini-shop-header";

type HeroStorefrontDemoProps = {
  shop: Pick<Shop, "name" | "city"> | null;
  products: Pick<Product, "id" | "name" | "priceCents" | "promoPriceCents" | "images">[];
};

/* Fallback при празна база — витрината никога не е празна (home crafts нишата). */
const FALLBACK_SHOP = { name: "Ателие Ръчичка", city: "Пловдив" };
const FALLBACK_PRODUCTS = [
  { id: "fallback-1", name: "Плетена кошница от ракита", priceCents: 3400, image: null },
  { id: "fallback-2", name: "Керамична чаша — глазура", priceCents: 2200, image: null },
  { id: "fallback-3", name: "Ленена покривка, ръчен шев", priceCents: 4500, image: null },
];

/** Плаваща карта — влиза с лек spring, използва се за нотификация/статистика. */
function FloatingCard({
  className,
  delay,
  children,
}: {
  className: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 12, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 22 }}
      className={`absolute z-20 rounded-2xl border border-surface-200 bg-surface-0 p-3 shadow-float ${className}`}
    >
      {children}
    </m.div>
  );
}

/**
 * Живата hero витрина — реален работещ магазин, ограден с плаващи сигнали
 * (нова поръчка, продажби днес). Демонстрира резултата, не просто UI-я.
 * Reduced-motion се поема централно от MotionConfig. На mobile: 2 продукта,
 * без плаващите карти (за да не се струпва).
 */
export function HeroStorefrontDemo({ shop, products }: HeroStorefrontDemoProps) {
  const name = shop?.name ?? FALLBACK_SHOP.name;
  const city = shop?.city ?? FALLBACK_SHOP.city;
  const items = products.length
    ? products.slice(0, 3).map((p) => ({
        id: p.id,
        name: p.name,
        priceCents: p.promoPriceCents ?? p.priceCents,
        image: p.images[0] ? publicImageUrl(p.images[0]) : null,
      }))
    : FALLBACK_PRODUCTS;

  return (
    <div className="relative mx-auto w-full max-w-md px-2 sm:px-6">
      {/* Топъл ореол зад витрината — дава ѝ тежест, не я оставя да плава в празно */}
      <div
        aria-hidden
        className="absolute inset-6 -z-10 rounded-4xl bg-brand-100/60 blur-2xl"
      />

      <m.div initial="hidden" animate="visible" variants={fadeUp}>
        <BrowserChrome url="frizmo.shop/s/atelie-rachichka">
          <m.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.15, 0.3)}
            className="flex flex-col gap-3 bg-surface-50 pb-5"
          >
            <MiniShopHeader name={name} city={city} />
            <div className="flex flex-col gap-2 px-5">
              {items.map((item, i) => (
                <m.div
                  key={item.id}
                  variants={fadeUp}
                  className={i === 2 ? "hidden sm:block" : undefined}
                >
                  <MiniProductCard
                    name={item.name}
                    priceCents={item.priceCents}
                    image={item.image}
                    priority={i === 0}
                  />
                </m.div>
              ))}
            </div>
          </m.div>
        </BrowserChrome>
      </m.div>

      {/* Плаваща нотификация „нова поръчка" — долу вляво, извън прозореца */}
      <FloatingCard delay={1.5} className="-bottom-5 -left-1 hidden w-max items-center gap-2.5 sm:flex">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-surface-0">
          <Icon name="bell" size={17} />
        </span>
        <span>
          <span className="block text-xs font-bold text-ink-900">Нова поръчка</span>
          <span className="block text-[11px] text-ink-500">Мария К. · {formatPrice(4700)}</span>
        </span>
      </FloatingCard>

      {/* Статистика „продажби днес" — горе вдясно */}
      <FloatingCard delay={1.9} className="-right-1 top-8 hidden w-max sm:block">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-500">
          <Icon name="trending-up" size={13} className="text-brand-600" />
          Продажби днес
        </span>
        <span className="mt-0.5 block font-display text-xl font-extrabold text-ink-900">
          {formatPrice(23400)}
        </span>
      </FloatingCard>
    </div>
  );
}
