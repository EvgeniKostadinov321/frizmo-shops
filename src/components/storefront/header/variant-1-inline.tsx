"use client";

import { useState } from "react";
import {
  Brand,
  buildNav,
  CartButton,
  type HeaderVariantProps,
  MenuButton,
  MobileMenu,
  NavLink,
  useHeaderState,
  useIsCurrent,
} from "./shared";

/**
 * Вариант 1 — Inline: лого вляво, навигация вдясно. Прозрачен върху hero
 * снимката на началната страница, „втвърдява" се при скрол. Универсалният
 * header — работи за всяка тема.
 */
export function HeaderVariant1({
  shop,
  settings,
  rootCategories = [],
  heroOverlay = false,
}: HeaderVariantProps) {
  const base = `/s/${shop.slug}`;
  const nav = buildNav(base, rootCategories);
  const isCurrent = useIsCurrent();
  const { overlayPage, scrolled } = useHeaderState(base, heroOverlay, false);
  const [menuOpen, setMenuOpen] = useState(false);
  const transparent = overlayPage && !scrolled && !menuOpen;

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,color] duration-300 ${
        overlayPage ? "-mb-19" : ""
      } ${
        transparent
          ? "border-b border-transparent bg-transparent text-white"
          : "border-b border-(--sf-border) bg-(--sf-bg)/90 text-(--sf-text) backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-19 max-w-6xl items-center justify-between gap-4 px-4">
        <Brand shop={shop} base={base} logoOnly={settings.logoOnly} />

        <nav
          aria-label="Навигация на магазина"
          className="hidden items-center gap-1 md:flex"
        >
          {nav.map((item) => (
            <NavLink key={item.href} item={item} current={isCurrent(item.href)} />
          ))}
          <CartButton shopId={shop.id} base={base} />
        </nav>

        <div className="flex items-center gap-1 md:hidden">
          <CartButton shopId={shop.id} base={base} />
          <MenuButton onOpen={() => setMenuOpen(true)} expanded={menuOpen} />
        </div>
      </div>

      <MobileMenu
        shop={shop}
        settings={settings}
        base={base}
        nav={nav}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
    </header>
  );
}
