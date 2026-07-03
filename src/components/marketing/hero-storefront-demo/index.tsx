"use client";

import { m } from "motion/react";
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

/* Fallback при празна база — витрината никога не е празна (home crafts нишата). */
const FALLBACK_SHOP = { name: "Ателие Ръчичка", city: "Пловдив" };
const FALLBACK_PRODUCTS = [
  { id: "fallback-1", name: "Плетена кошница от ракита", priceCents: 3400, image: null },
  { id: "fallback-2", name: "Керамична чаша — глазура", priceCents: 2200, image: null },
  { id: "fallback-3", name: "Ленена покривка, ръчен шев", priceCents: 4500, image: null },
];

/**
 * Живата hero витрина (спец §4) — сглобява се пред очите на посетителя:
 * прозорец → header → продукти каскадно → badge на количката (~1.4s).
 * Reduced-motion се поема централно от MotionConfig. На mobile: 2 продукта.
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
    <m.div initial="hidden" animate="visible" variants={fadeUp} className="mx-auto w-full max-w-md">
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
              <m.div key={item.id} variants={fadeUp} className={i === 2 ? "hidden sm:block" : undefined}>
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
  );
}
