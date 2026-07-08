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
  NavLink,
  splitNav,
  useHeaderState,
  useIsCurrent,
} from "./shared";
import { NavOverflow } from "./nav-overflow";

/**
 * Вариант 2 — Split Bar: единичен ред, логото центрирано, навигацията
 * разделена симетрично отдвете му страни (първата половина линкове вляво,
 * втората вдясно), количката накрая. Бутиков/editorial глас без втори ред —
 * логото стои в центъра на композицията. Не участва в hero overlay (плътен
 * фон). На мобилно: бургер вляво, лого център, количка вдясно.
 */
export function HeaderVariant2({ shop, settings, rootCategories = [] }: HeaderVariantProps) {
  const base = `/s/${shop.slug}`;
  const nav = buildNav(base, rootCategories, settings.navLinks);
  const { inline, overflow } = splitNav(nav);
  const isCurrent = useIsCurrent();
  const { scrolled } = useHeaderState(base, false, true);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Разделяме инлайн частта на две равни крила около логото; излишъкът (ако
     има) отива в „Още" dropdown вдясно. */
  const mid = Math.ceil(inline.length / 2);
  const leftNav = inline.slice(0, mid);
  const rightNav = inline.slice(mid);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-(--sf-bg)/90 text-(--sf-text) backdrop-blur-md transition-[border-color,box-shadow] duration-300 ${
        scrolled ? "border-(--sf-border) shadow-(--sf-shadow)" : "border-(--sf-border)"
      }`}
    >
      <div className="mx-auto flex h-19 max-w-6xl items-center gap-4 px-4">
        {/* Ляво крило (десктоп) / бургер (мобилно) */}
        <div className="flex flex-1 items-center">
          <nav
            aria-label="Навигация — ляво"
            className="hidden items-center gap-1 md:flex"
          >
            {leftNav.map((item) => (
              <NavLink key={item.href} item={item} current={isCurrent(item.href)} />
            ))}
          </nav>
          <div className="md:hidden">
            <MenuButton onOpen={() => setMenuOpen(true)} expanded={menuOpen} />
          </div>
        </div>

        {/* Лого — центрирано */}
        <div className="flex shrink-0 justify-center">
          <Brand shop={shop} base={base} logoOnly={settings.logoOnly} />
        </div>

        {/* Дясно крило (десктоп) + количка */}
        <div className="flex flex-1 items-center justify-end gap-1">
          <nav
            aria-label="Навигация — дясно"
            className="hidden items-center gap-1 md:flex"
          >
            {rightNav.map((item) => (
              <NavLink key={item.href} item={item} current={isCurrent(item.href)} />
            ))}
            <NavOverflow items={overflow} />
          </nav>
          <FavoritesButton shopId={shop.id} base={base} />
          <CartButton shopId={shop.id} base={base} />
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
