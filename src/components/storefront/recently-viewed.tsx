"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/db";
import { getProductsByIdsAction } from "@/actions/storefront";
import { readRecentlyViewed, recordRecentlyViewed } from "@/lib/recently-viewed";
import { ProductCard } from "@/components/storefront/product-card";

interface RecentlyViewedProps {
  shopId: string;
  slug: string;
  base: string;
  /** Текущият продукт: записва се като разгледан и се скрива от списъка. */
  currentProductId: string;
}

/**
 * „Последно разглеждани" под продукта: id-тата живеят в localStorage,
 * данните идват от сървъра (само активни продукти на магазина). Рендерира
 * се чак когато има какво да покаже — никакъв layout скок при празен списък.
 */
export function RecentlyViewed({ shopId, slug, base, currentProductId }: RecentlyViewedProps) {
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    const ids = readRecentlyViewed(shopId).filter((id) => id !== currentProductId);
    /* Записваме текущия СЛЕД четенето — да не се показва сам на себе си. */
    recordRecentlyViewed(shopId, currentProductId);
    if (ids.length === 0) return;
    let cancelled = false;
    getProductsByIdsAction(slug, ids).then((result) => {
      if (!cancelled && result.ok) setItems(result.data.slice(0, 4));
    });
    return () => {
      cancelled = true;
    };
  }, [shopId, slug, currentProductId]);

  if (items.length === 0) return null;

  return (
    <div className="mt-14">
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-(--sf-primary)">
          Върни се към
        </p>
        <h2 className="text-2xl text-(--sf-text)">Последно разглеждани</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p.id} product={p} base={base} />
        ))}
      </div>
    </div>
  );
}
