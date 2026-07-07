"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import type { NavItem } from "./shared";

/**
 * „Още ∨" dropdown за навигационните линкове, които не се събират инлайн.
 * Затваря при клик отвън и Escape; клавиатурно достъпен. Темови токени —
 * панелът се облича с гласа на темата. Ползва се само на десктоп (мобилното
 * меню показва пълния списък в бургера).
 */
export function NavOverflow({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="sf-nav-link flex h-11 shrink-0 items-center gap-1 px-3 text-sm font-medium text-current"
      >
        Още
        <span aria-hidden className={`flex transition-transform ${open ? "rotate-180" : ""}`}>
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-44 overflow-hidden rounded-(--sf-radius) border border-(--sf-border) bg-(--sf-surface-raised) py-1 shadow-(--sf-shadow)"
        >
          {items.map((item) =>
            item.external ? (
              <a
                key={item.href}
                role="menuitem"
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 text-sm font-medium text-(--sf-text) transition-colors hover:bg-(--sf-surface)"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                role="menuitem"
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 text-sm font-medium text-(--sf-text) transition-colors hover:bg-(--sf-surface)"
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
