"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";

/** Лупа-икона → отваряща `fixed` търсеща лента (overlay), submit към /products?search=. */
export function HeaderSearch({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Търсене"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex size-11 items-center justify-center rounded-(--sf-radius) text-current transition-opacity hover:opacity-70"
      >
        <Icon name="search" size={20} />
      </button>
      {open && (
        <div className="fixed inset-x-0 top-0 z-50 border-b border-(--sf-border) bg-(--sf-bg) text-(--sf-text)">
          <form
            role="search"
            action={`${base}/products`}
            className="mx-auto flex h-19 max-w-6xl items-center gap-3 px-4"
          >
            <span aria-hidden className="shrink-0 text-(--sf-muted)">
              <Icon name="search" size={20} />
            </span>
            <input
              ref={inputRef}
              type="search"
              name="search"
              required
              placeholder="Търси в магазина…"
              aria-label="Търсене на продукти"
              enterKeyHint="search"
              className="h-11 flex-1 bg-transparent text-(--sf-text) placeholder:text-(--sf-muted) focus:outline-none"
            />
            <button
              type="button"
              aria-label="Затвори търсенето"
              onClick={() => setOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-(--sf-radius) text-(--sf-muted) transition-colors hover:text-(--sf-text)"
            >
              <Icon name="x" size={22} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
