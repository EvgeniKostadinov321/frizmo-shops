"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getFavoriteProducts } from "@/actions/favorites";
import { MascotState } from "@/components/storefront/mascot";
import { ProductCard } from "@/components/storefront/product-card";
import type { Product } from "@/db";
import {
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  onFavoritesChange,
} from "@/lib/favorites-storage";

interface FavoritesViewProps {
  shopId: string;
  slug: string;
  base: string;
  logoPath?: string | null;
  /** Логнат купувач → любимите идват от акаунта (виж accountProducts). */
  loggedIn?: boolean;
  /** Server-rendered любими на логнатия купувач за ТОЗИ магазин (null = гост). */
  accountProducts?: Product[] | null;
}

/**
 * Любими продукти. Логнат купувач → показва акаунт любимите (server-rendered);
 * премахването от сърцето маха картата на живо. Гост → localStorage (S10): данните
 * идват от сървъра при показване, премахването обновява списъка на живо.
 */
export function FavoritesView({
  shopId,
  slug,
  base,
  logoPath,
  loggedIn = false,
  accountProducts = null,
}: FavoritesViewProps) {
  if (loggedIn) {
    return (
      <AccountFavorites base={base} logoPath={logoPath} initial={accountProducts ?? []} />
    );
  }
  return <GuestFavorites shopId={shopId} slug={slug} base={base} logoPath={logoPath} />;
}

/** Логнат: акаунт любимите; при un-favorite картата изчезва веднага (локален стейт). */
function AccountFavorites({
  base,
  logoPath,
  initial,
}: {
  base: string;
  logoPath?: string | null;
  initial: Product[];
}) {
  const [products, setProducts] = useState(initial);
  if (products.length === 0) return <EmptyFavorites base={base} logoPath={logoPath} />;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          base={base}
          loggedIn
          favorited
          onUnfavorite={() => setProducts((ps) => ps.filter((p) => p.id !== product.id))}
        />
      ))}
    </div>
  );
}

/** Гост: любимите живеят в localStorage; данните идват от сървъра при показване. */
function GuestFavorites({
  shopId,
  slug,
  base,
  logoPath,
}: {
  shopId: string;
  slug: string;
  base: string;
  logoPath?: string | null;
}) {
  const ids = useSyncExternalStore(
    (cb) => onFavoritesChange(shopId, cb),
    () => getFavoritesSnapshot(shopId),
    getServerFavoritesSnapshot,
  );
  const [products, setProducts] = useState<Product[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const idsKey = JSON.stringify(ids);
  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) setProducts([]);
      });
      return () => {
        cancelled = true;
      };
    }
    /* Дребен debounce: бърза серия от премахвания = една заявка. */
    const timer = setTimeout(async () => {
      const result = await getFavoriteProducts(slug, ids);
      if (cancelled) return;
      if (!result.ok) {
        setFailure(result.error);
        return;
      }
      setFailure(null);
      setProducts(result.data.products);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, slug]);

  if (ids.length === 0) return <EmptyFavorites base={base} logoPath={logoPath} />;

  if (failure) {
    return <p className="py-12 text-center text-(--sf-muted)">{failure}</p>;
  }

  if (products === null) {
    /* Скелет докато сървърните данни пътуват. */
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true">
        {ids.slice(0, 8).map((id) => (
          <div
            key={id}
            className="aspect-4/5 animate-pulse rounded-(--sf-radius) bg-(--sf-surface-raised)"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} base={base} />
      ))}
    </div>
  );
}

function EmptyFavorites({ base, logoPath }: { base: string; logoPath?: string | null }) {
  return (
    <MascotState
      icon="products"
      logoPath={logoPath}
      title="Още нямаш любими"
      text="Цъкни сърцето на продукт, за да го запазиш за после."
      action={
        <Link
          href={`${base}/products`}
          className="inline-flex h-11 items-center rounded-(--sf-radius) bg-(--sf-primary) px-5 font-medium text-(--sf-on-primary) transition-opacity hover:opacity-90"
        >
          Разгледай продуктите
        </Link>
      }
    />
  );
}
