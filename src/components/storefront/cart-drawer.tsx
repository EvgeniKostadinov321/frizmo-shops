"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui";
import { CartView } from "@/components/storefront/cart-view";
import { themeStyle } from "@/lib/themes";
import type { SiteSettings } from "@/schemas/site-settings";

const OPEN_EVENT = "frizmo-cart-open";

/** Отваря mini-cart drawer-а отвсякъде (header бутон, toast действие). */
export function openCartDrawer() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

interface CartDrawerProps {
  shopId: string;
  slug: string;
  base: string;
  settings: SiteSettings;
  logoPath?: string | null;
  freeShippingOverCents: number | null;
}

/**
 * Mini-cart: страничен drawer с пълния CartView (същия компонент като
 * страницата /cart — една логика, две опаковки). Портал в собствен контейнер
 * на <body> + themeStyle, по механиката на MobileMenu (header/shared.tsx).
 */
export function CartDrawer({ shopId, slug, base, settings, logoPath, freeShippingOverCents }: CartDrawerProps) {
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    queueMicrotask(() => setContainer(el));
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      document.body.removeChild(el);
    };
  }, []);

  /* Монтиран до края на exit анимацията: render изпреварва open при enter
     и закъснява при exit; shown кара transition-а (виж MobileMenu). */
  const [render, setRender] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      let raf = 0;
      queueMicrotask(() => {
        setRender(true);
        raf = requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    queueMicrotask(() => setShown(false));
    const t = setTimeout(() => setRender(false), 320);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    const prevOverflow = root.style.overflow;
    const prevPadding = root.style.paddingRight;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;

    /* Запомни фокуса, за да го върнем при затваряне; фокусирай drawer-а. */
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    queueMicrotask(() => panelRef.current?.focus());

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      /* Focus trap: Tab не бива да излиза зад drawer-а към заключената страница. */
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prevOverflow;
      root.style.paddingRight = prevPadding;
      window.removeEventListener("keydown", onKey);
      /* Върни фокуса към елемента, отворил drawer-а (cart бутона). */
      returnFocusRef.current?.focus();
    };
  }, [render]);

  if (!render || !container) return null;

  return createPortal(
    <div data-storefront style={themeStyle(settings)} className="fixed inset-0 z-100">
      <button
        type="button"
        aria-label="Затвори количката"
        onClick={() => setOpen(false)}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Количка"
        className={`absolute inset-y-0 right-0 flex w-[min(420px,92vw)] flex-col bg-(--sf-bg) pb-[env(safe-area-inset-bottom)] text-(--sf-text) shadow-(--sf-shadow) outline-none transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex h-19 shrink-0 items-center justify-between border-b border-(--sf-border) px-5">
          <h2 className="text-xl text-(--sf-text)">Количка</h2>
          <button
            type="button"
            aria-label="Затвори количката"
            onClick={() => setOpen(false)}
            className="flex size-11 items-center justify-center rounded-(--sf-radius) transition-opacity hover:opacity-70"
          >
            <Icon name="x" size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <CartView
            shopId={shopId}
            slug={slug}
            base={base}
            logoPath={logoPath}
            freeShippingOverCents={freeShippingOverCents}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </aside>
    </div>,
    container,
  );
}
