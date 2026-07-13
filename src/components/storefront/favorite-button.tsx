"use client";

import { useState, useSyncExternalStore } from "react";
import { toggleFavoriteProduct } from "@/actions/buyer";
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
  /** Логнат купувач → любимите се пазят в акаунта (база); гост → localStorage. */
  loggedIn?: boolean;
  /** Начално състояние за логнат купувач (от базата, server-rendered). */
  initialFavorited?: boolean;
  /** Логнат: извиква се при успешно ПРЕМАХВАНЕ (за live обновяване на списъци). */
  onUnfavorite?: () => void;
}

/**
 * Сърце-toggle за любими продукти. Логнат купувач → акаунт-базирано
 * (`toggleFavoriteProduct`, оптимистично — веднага се вижда в /account/favorites
 * от всички магазини). Гост → localStorage per-магазин (мигрира се при вход през
 * FavoritesMerger). Работи и вътре в Link (card) — гаси навигацията.
 */
export function FavoriteButton({
  shopId,
  productId,
  variant = "card",
  loggedIn = false,
  initialFavorited = false,
  onUnfavorite,
}: FavoriteButtonProps) {
  const localIds = useSyncExternalStore(
    (cb) => onFavoritesChange(shopId, cb),
    () => getFavoritesSnapshot(shopId),
    getServerFavoritesSnapshot,
  );
  /* Логнат: състоянието е в акаунта (локален optimistic стейт). Гост: localStorage. */
  const [accFav, setAccFav] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const active = loggedIn ? accFav : localIds.includes(productId);

  const base =
    variant === "card"
      ? "absolute right-2 top-2 z-10 flex size-11 items-center justify-center rounded-full bg-(--sf-surface-raised)/90 shadow-(--sf-shadow) backdrop-blur-sm transition-transform hover:scale-110"
      : "flex size-11 items-center justify-center rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) transition-colors hover:border-(--sf-primary)";

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      toggleFavorite(shopId, productId);
      return;
    }
    if (busy) return;
    setBusy(true);
    const next = !accFav;
    setAccFav(next);
    const res = await toggleFavoriteProduct(productId);
    if (!res.ok) setAccFav(!next);
    else if (!next) onUnfavorite?.();
    setBusy(false);
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Премахни от любими" : "Добави в любими"}
      disabled={busy}
      onClick={onClick}
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
