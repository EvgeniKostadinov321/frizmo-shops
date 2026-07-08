"use client";

/**
 * Любими продукти per-магазин в localStorage (гост, без профил — S10).
 * Пази се САМО масив от product id-та; данните/цените идват от сървъра при
 * показване. Акаунт версията идва с купувателския акаунт (S3).
 */

const FAVORITES_EVENT = "frizmo-favorites-changed";
const key = (shopId: string) => `frizmo-favorites-${shopId}`;
const MAX_FAVORITES = 100;

function parseIds(raw: string | null): string[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string").slice(0, MAX_FAVORITES);
  } catch {
    return [];
  }
}

export function readFavorites(shopId: string): string[] {
  if (typeof window === "undefined") return [];
  return parseIds(window.localStorage.getItem(key(shopId)));
}

/* Стабилен snapshot за useSyncExternalStore (нов масив само при реална промяна). */
const snapshotCache = new Map<string, { raw: string | null; ids: string[] }>();

export function getFavoritesSnapshot(shopId: string): string[] {
  const raw = window.localStorage.getItem(key(shopId));
  const cached = snapshotCache.get(shopId);
  if (cached && cached.raw === raw) return cached.ids;
  const ids = parseIds(raw);
  snapshotCache.set(shopId, { raw, ids });
  return ids;
}

const EMPTY: string[] = [];
export function getServerFavoritesSnapshot(): string[] {
  return EMPTY;
}

function writeFavorites(shopId: string, ids: string[]) {
  window.localStorage.setItem(key(shopId), JSON.stringify(ids.slice(0, MAX_FAVORITES)));
  window.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { shopId } }));
}

export function toggleFavorite(shopId: string, productId: string) {
  const ids = readFavorites(shopId);
  writeFavorites(
    shopId,
    ids.includes(productId) ? ids.filter((id) => id !== productId) : [...ids, productId],
  );
}

export function removeFavorite(shopId: string, productId: string) {
  writeFavorites(
    shopId,
    readFavorites(shopId).filter((id) => id !== productId),
  );
}

/** Абонамент за промени (в този таб + от други табове през storage събитието). */
export function onFavoritesChange(shopId: string, callback: () => void): () => void {
  const onCustom = (e: Event) => {
    if ((e as CustomEvent<{ shopId: string }>).detail?.shopId === shopId) callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === key(shopId)) callback();
  };
  window.addEventListener(FAVORITES_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(FAVORITES_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
