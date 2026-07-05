"use client";

/**
 * „Последно разглеждани" per-магазин в localStorage (както количката —
 * гост без профил). Пази се САМО списък от product id-та; данните за
 * показване идват от сървъра при рендер.
 */

const MAX_ITEMS = 8;
const key = (shopId: string) => `frizmo-viewed-${shopId}`;

export function readRecentlyViewed(shopId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key(shopId)) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Отбелязва разглеждане: най-новото отпред, без дубли, до MAX_ITEMS. */
export function recordRecentlyViewed(shopId: string, productId: string) {
  const next = [productId, ...readRecentlyViewed(shopId).filter((id) => id !== productId)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    window.localStorage.setItem(key(shopId), JSON.stringify(next));
  } catch {
    /* localStorage недостъпен — функцията е бонус, не критична */
  }
}
