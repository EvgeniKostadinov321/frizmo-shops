"use client";

/**
 * Количка per-магазин в localStorage (гост, без профил).
 * Клиентът пази САМО { productId, variantKey, qty } — всички цени идват от
 * сървъра (pricing engine) при всяко показване.
 */

export interface StoredCartLine {
  productId: string;
  variantKey: string | null;
  qty: number;
}

const CART_EVENT = "frizmo-cart-changed";
const key = (shopId: string) => `frizmo-cart-${shopId}`;

function parseLines(raw: string | null): StoredCartLine[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is StoredCartLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as StoredCartLine).productId === "string" &&
        Number.isInteger((l as StoredCartLine).qty) &&
        (l as StoredCartLine).qty > 0,
    );
  } catch {
    return [];
  }
}

export function readCart(shopId: string): StoredCartLine[] {
  if (typeof window === "undefined") return [];
  return parseLines(window.localStorage.getItem(key(shopId)));
}

/* Стабилен snapshot за useSyncExternalStore (нов масив само при реална промяна). */
const snapshotCache = new Map<string, { raw: string | null; lines: StoredCartLine[] }>();

export function getCartSnapshot(shopId: string): StoredCartLine[] {
  const raw = window.localStorage.getItem(key(shopId));
  const cached = snapshotCache.get(shopId);
  if (cached && cached.raw === raw) return cached.lines;
  const lines = parseLines(raw);
  snapshotCache.set(shopId, { raw, lines });
  return lines;
}

const EMPTY_CART: StoredCartLine[] = [];
export function getServerCartSnapshot(): StoredCartLine[] {
  return EMPTY_CART;
}

function writeCart(shopId: string, lines: StoredCartLine[]) {
  window.localStorage.setItem(key(shopId), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { shopId } }));
}

const sameLine = (a: StoredCartLine, b: StoredCartLine) =>
  a.productId === b.productId && a.variantKey === b.variantKey;

export function addToCart(shopId: string, line: StoredCartLine) {
  const lines = readCart(shopId);
  const existing = lines.find((l) => sameLine(l, line));
  if (existing) existing.qty = Math.min(existing.qty + line.qty, 999);
  else lines.push(line);
  writeCart(shopId, lines);
}

export function setCartQty(shopId: string, line: StoredCartLine, qty: number) {
  let lines = readCart(shopId);
  if (qty < 1) lines = lines.filter((l) => !sameLine(l, line));
  else lines = lines.map((l) => (sameLine(l, line) ? { ...l, qty: Math.min(qty, 999) } : l));
  writeCart(shopId, lines);
}

export function removeFromCart(shopId: string, line: StoredCartLine) {
  writeCart(
    shopId,
    readCart(shopId).filter((l) => !sameLine(l, line)),
  );
}

export function clearCart(shopId: string) {
  writeCart(shopId, []);
}

export function cartCount(shopId: string): number {
  return readCart(shopId).reduce((sum, l) => sum + l.qty, 0);
}

/** Абонамент за промени (в този таб + от други табове през storage събитието). */
export function onCartChange(shopId: string, callback: () => void): () => void {
  const onCustom = (e: Event) => {
    if ((e as CustomEvent<{ shopId: string }>).detail?.shopId === shopId) callback();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === key(shopId)) callback();
  };
  window.addEventListener(CART_EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CART_EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
