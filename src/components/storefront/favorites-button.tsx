"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";
import {
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  onFavoritesChange,
} from "@/lib/favorites-storage";

/** Любими в storefront header-а: линк към /favorites с жив брояч (S10). */
export function FavoritesButton({ shopId, base }: { shopId: string; base: string }) {
  const ids = useSyncExternalStore(
    (cb) => onFavoritesChange(shopId, cb),
    () => getFavoritesSnapshot(shopId),
    getServerFavoritesSnapshot,
  );

  return (
    <Link
      href={`${base}/favorites`}
      aria-label={`Любими (${ids.length})`}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
    >
      <Icon name="heart" size={22} />
      {ids.length > 0 && (
        <span className="absolute right-0 top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-(--sf-primary) px-1 text-[10px] font-bold leading-4 text-(--sf-on-primary)">
          {ids.length > 99 ? "99+" : ids.length}
        </span>
      )}
    </Link>
  );
}
