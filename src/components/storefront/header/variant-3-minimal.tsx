"use client";

import { useState } from "react";
import {
  Brand,
  buildNav,
  CartButton,
  FavoritesButton,
  type HeaderVariantProps,
  MenuButton,
  MobileMenu,
  useHeaderState,
} from "./shared";

/**
 * Вариант 3 — Minimal: лого вляво, само количка + бургер вдясно (навигацията
 * е скрита в fullscreen менюто И на десктоп). Максимален фокус върху
 * съдържанието — за image-first магазини (Витрина, Пулс). Прозрачен върху
 * hero снимката на началната страница като вариант 1.
 */
export function HeaderVariant3({
  shop,
  settings,
  rootCategories = [],
  heroOverlay = false,
}: HeaderVariantProps) {
  const base = `/s/${shop.slug}`;
  const nav = buildNav(base, rootCategories, settings.navLinks);
  const { overlayPage, scrolled } = useHeaderState(base, heroOverlay, false);
  const [menuOpen, setMenuOpen] = useState(false);
  const transparent = overlayPage && !scrolled && !menuOpen;

  return (
    <>
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
          <div className="flex items-center gap-1">
            <FavoritesButton shopId={shop.id} base={base} />
            <CartButton shopId={shop.id} base={base} />
            <MenuButton onOpen={() => setMenuOpen(true)} expanded={menuOpen} />
          </div>
        </div>
      </header>

      {/* Менюто се рендерира през портал в <body> — не влияе на header-а.
          Минимал вариантът го показва и на десктоп (desktopVisible). */}
      <MobileMenu
        shop={shop}
        settings={settings}
        base={base}
        nav={nav}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        desktopVisible
      />
    </>
  );
}
