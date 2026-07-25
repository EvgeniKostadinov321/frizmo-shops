"use client";

import { m } from "motion/react";
import { Icon } from "@/components/ui";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { formatPrice } from "@/lib/money";
import { BrowserChrome } from "./browser-chrome";
import { MiniProductCard } from "./mini-product-card";
import { MiniShopHeader } from "./mini-shop-header";

/*
 * Куриран showcase магазин — статични bundle-нати асети (Magnific, 2026-07-25),
 * НЕ база: витрината е винаги пълна и красива, независимо от съдържанието на
 * прод базата (решение 2026-07-25 — без seed на демо магазини на прод).
 */
const SHOWCASE_SHOP = { name: "Ателие Ръчичка", city: "Пловдив" };
const SHOWCASE_PRODUCTS = [
  { id: "mug", name: "Керамична чаша „Есен“", priceCents: 3400, image: "/landing/hero-mug.webp" },
  { id: "basket", name: "Плетена кошница от ракита", priceCents: 4500, image: "/landing/hero-basket.webp" },
  { id: "linen", name: "Ленена покривка с шевица", priceCents: 5800, image: "/landing/hero-linen.webp" },
];

/**
 * Плаваща карта — влиза с лек spring и после леко „диша" (бавен y-loop).
 * Reduced-motion се поема централно от MotionConfig (изключва transform).
 */
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
      <m.div
        animate={{ y: [0, -5, 0] }}
        transition={{ delay: delay + 1, duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

/**
 * Живата hero витрина — куриран showcase магазин с реална продуктова
 * фотография, ограден с плаващи сигнали (поръчка, продажби, отзив).
 * Лек 3D tilt на desktop (изправя се при hover) — чист CSS, без WebGL.
 * На mobile: 2 продукта + само картата „Нова поръчка".
 */
export function HeroStorefrontDemo() {
  return (
    <div className="relative mx-auto w-full max-w-md px-2 sm:px-6 lg:perspective-[1400px]">
      {/* Топъл ореол зад витрината — дава ѝ тежест, не я оставя да плава в празно */}
      <div
        aria-hidden
        className="absolute inset-6 -z-10 rounded-4xl bg-brand-100/60 blur-2xl"
      />

      {/* Tilt-ът живее на СОБСТВЕН слой — Motion пише inline transform върху
          вътрешния m.div и би го изтрил, ако са на един елемент. */}
      <div className="transition-transform duration-500 motion-reduce:transition-none lg:transform-[rotateY(-7deg)_rotateX(2deg)] lg:hover:transform-[rotateY(0deg)_rotateX(0deg)]">
        <m.div initial="hidden" animate="visible" variants={fadeUp}>
          <BrowserChrome url="frizmoshops.bg/s/atelie-rachichka">
          <m.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.15, 0.3)}
            className="flex flex-col gap-3 bg-surface-50 pb-5"
          >
            <MiniShopHeader name={SHOWCASE_SHOP.name} city={SHOWCASE_SHOP.city} />
            <div className="flex flex-col gap-2 px-5">
              {SHOWCASE_PRODUCTS.map((item, i) => (
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
      </div>

      {/* Плаваща нотификация „нова поръчка" — долу вляво; единствената видима на mobile */}
      <FloatingCard delay={1.5} className="-bottom-5 -left-1 flex w-max items-center gap-2.5">
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

      {/* Отзив с 5 звезди — виси под долния десен ъгъл, не покрива продуктите */}
      <FloatingCard delay={2.3} className="-bottom-12 right-2 hidden w-44 sm:block">
        <span aria-hidden className="flex items-center gap-0.5 text-ember-700">
          {Array.from({ length: 5 }, (_, i) => (
            <Icon key={i} name="star" size={12} className="fill-current" />
          ))}
        </span>
        <span className="mt-1 block text-[11px] leading-snug text-ink-700">
          „Пристигна за два дни — прекрасна изработка!“
        </span>
        <span className="mt-1 block text-[10px] font-semibold text-ink-500">Виктория Д.</span>
      </FloatingCard>
    </div>
  );
}
