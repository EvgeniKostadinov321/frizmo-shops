"use client";

import { m, useReducedMotion } from "motion/react";
import type { Product, Shop } from "@/db";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { publicImageUrl } from "@/lib/storage";
import { BrowserChrome } from "./browser-chrome";
import { MiniProductCard } from "./mini-product-card";
import { MiniShopHeader } from "./mini-shop-header";

type HeroStorefrontDemoProps = {
  shop: Pick<Shop, "name" | "city"> | null;
  products: Pick<Product, "id" | "name" | "priceCents" | "promoPriceCents" | "images">[];
};

/* Fallback при празна база — витрината никога не е празна. */
const FALLBACK_SHOP = { name: "Ферма Зелена долина", city: "Троян" };
const FALLBACK_PRODUCTS = [
  { id: "fallback-1", name: "Краве сирене", priceCents: 1590, image: null },
  { id: "fallback-2", name: "Планински мед", priceCents: 1250, image: null },
  { id: "fallback-3", name: "Домашен кашкавал", priceCents: 2300, image: null },
];

/**
 * Живата hero витрина (спец §4) — сглобява се пред очите на посетителя:
 * прозорец → header → продукти каскадно → badge на количката (~1.4s).
 * При prefers-reduced-motion: статично сглобена. На mobile: 2 продукта.
 */
export function HeroStorefrontDemo({ shop, products }: HeroStorefrontDemoProps) {
  const reducedMotion = useReducedMotion();
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

  const content = (
    <div className="flex flex-col gap-3 bg-surface-50 pb-5">
      <MiniShopHeader name={name} city={city} />
      <div className="flex flex-col gap-2 px-5">
        {items.map((item, i) =>
          reducedMotion ? (
            <div key={item.id} className={i === 2 ? "hidden sm:block" : undefined}>
              <MiniProductCard
                name={item.name}
                priceCents={item.priceCents}
                image={item.image}
                priority={i === 0}
              />
            </div>
          ) : (
            <m.div key={item.id} variants={fadeUp} className={i === 2 ? "hidden sm:block" : undefined}>
              <MiniProductCard
                name={item.name}
                priceCents={item.priceCents}
                image={item.image}
                priority={i === 0}
              />
            </m.div>
          ),
        )}
      </div>
    </div>
  );

  if (reducedMotion) {
    return (
      <div className="mx-auto w-full max-w-md">
        <BrowserChrome url="frizmo.shop/s/ferma-zelena-dolina">{content}</BrowserChrome>
      </div>
    );
  }

  return (
    <m.div initial="hidden" animate="visible" variants={fadeUp} className="mx-auto w-full max-w-md">
      <BrowserChrome url="frizmo.shop/s/ferma-zelena-dolina">
        <m.div initial="hidden" animate="visible" variants={staggerContainer(0.15, 0.3)}>
          {content}
        </m.div>
      </BrowserChrome>
    </m.div>
  );
}
