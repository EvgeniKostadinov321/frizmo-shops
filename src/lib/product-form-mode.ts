"use client";

/**
 * „Бързо/Детайлно" режим на продуктовата форма, запомнен в localStorage.
 * Само визуален превключвател — скритите полета не се изтриват. Default: детайлно
 * (запазва сегашното поведение за съществуващи потребители).
 */

export type FormMode = "quick" | "detailed";
const KEY = "frizmo-product-form-mode";
const EVENT = "frizmo-product-form-mode-changed";

function parse(raw: string | null): FormMode {
  return raw === "quick" ? "quick" : "detailed";
}

/* Стабилен snapshot за useSyncExternalStore (нова стойност само при реална промяна). */
let cache: { raw: string | null; mode: FormMode } | null = null;

export function getModeSnapshot(): FormMode {
  const raw = window.localStorage.getItem(KEY);
  if (cache && cache.raw === raw) return cache.mode;
  const mode = parse(raw);
  cache = { raw, mode };
  return mode;
}

export function getServerModeSnapshot(): FormMode {
  return "detailed";
}

export function setMode(mode: FormMode) {
  window.localStorage.setItem(KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onModeChange(callback: () => void): () => void {
  const onCustom = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
