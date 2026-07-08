"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui";
import {
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  onFavoritesChange,
  toggleFavorite,
} from "@/lib/favorites-storage";

interface FavoriteButtonProps {
  shopId: string;
  productId: string;
  /** card = кръгъл overlay върху снимката · page = самостоятелен 44px бутон. */
  variant?: "card" | "page";
}

/** Сърце-toggle за любими (S10). Работи и вътре в Link (card) — гаси навигацията. */
export function FavoriteButton({ shopId, productId, variant = "card" }: FavoriteButtonProps) {
  const ids = useSyncExternalStore(
    (cb) => onFavoritesChange(shopId, cb),
    () => getFavoritesSnapshot(shopId),
    getServerFavoritesSnapshot,
  );
  const active = ids.includes(productId);

  const base =
    variant === "card"
      ? "absolute right-2 top-2 z-10 flex size-11 items-center justify-center rounded-full bg-(--sf-surface-raised)/90 shadow-(--sf-shadow) backdrop-blur-sm transition-transform hover:scale-110"
      : "flex size-11 items-center justify-center rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) transition-colors hover:border-(--sf-primary)";

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Премахни от любими" : "Добави в любими"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(shopId, productId);
      }}
      className={`${base} ${active ? "text-(--sf-primary)" : "text-(--sf-muted)"}`}
    >
      <Icon
        name="heart"
        size={variant === "card" ? 18 : 22}
        className={active ? "fill-current" : ""}
      />
    </button>
  );
}
