"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, LinkButton, Logo } from "@/components/ui";

const nav = [
  { href: "/shops", label: "Магазини" },
  { href: "/products", label: "Продукти" },
  { href: "/blog", label: "Блог" },
  { href: "/#pricing", label: "Цени" },
];

/**
 * Marketing header: floating pill на desktop (прозрачен → фон+сянка при скрол),
 * hamburger + пълноекранен overlay на mobile. Активният линк се подчертава.
 */
export function SiteHeader({ loggedIn = false }: { loggedIn?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    /* Първоначалното състояние — извън синхронния effect (react-compiler lint) */
    queueMicrotask(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Заключваме скрола + затваряме с Escape докато overlay-ът е отворен */
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const isActive = (href: string) =>
    href.startsWith("/#") ? false : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div
        className={`relative z-40 mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-300 ${
          menuOpen
            ? "border border-surface-200 bg-surface-0 shadow-card"
            : scrolled
              ? "border border-surface-200 bg-surface-0/90 shadow-card backdrop-blur"
              : "border border-transparent"
        }`}
      >
        <Logo className="shrink-0" />

        {/* Desktop навигация */}
        <nav aria-label="Основна навигация" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`flex h-11 items-center rounded-full px-3.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-surface-100 text-ink-900"
                  : "text-ink-700 hover:bg-surface-100 hover:text-ink-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {loggedIn ? (
            <Link
              href="/account"
              aria-label="Моят профил"
              className="flex size-11 items-center justify-center rounded-full text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
            >
              <Icon name="user" size={22} />
            </Link>
          ) : (
            <Link
              href="/auth/login?role=buyer&next=/account"
              className="flex h-11 items-center rounded-full px-3.5 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
            >
              Вход
            </Link>
          )}
          <span className="ml-1">
            <LinkButton href="/auth/register?role=seller" size="sm">
              Създай магазин
            </LinkButton>
          </span>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "Затвори менюто" : "Отвори менюто"}
          className="flex size-11 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-surface-100 md:hidden"
        >
          <Icon name={menuOpen ? "x" : "menu"} size={22} />
        </button>
      </div>

      {/* Mobile пълноекранен overlay — плътен фон до ръба (без прозиране на сайта отзад).
          Стои под pill-а (z-30 < header z-40), затова започва под него с pt. */}
      {menuOpen && (
        <div
          id="mobile-nav"
          className="fixed inset-0 z-30 animate-fade-in bg-surface-50 px-3 pt-20 md:hidden"
        >
          <nav
            aria-label="Мобилна навигация"
            className="mx-auto flex max-w-7xl flex-col gap-1 px-3 pt-4"
          >
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex items-center justify-between rounded-2xl px-4 py-4 font-display text-2xl font-extrabold tracking-tight transition-colors ${
                  isActive(item.href) ? "bg-surface-100 text-ink-900" : "text-ink-900 hover:bg-surface-100"
                }`}
              >
                {item.label}
                <Icon name="chevron-down" size={20} className="-rotate-90 text-ink-500" />
              </Link>
            ))}
            <Link
              href={loggedIn ? "/account" : "/auth/login?role=buyer&next=/account"}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-2xl px-4 py-4 font-display text-2xl font-extrabold tracking-tight text-ink-900 transition-colors hover:bg-surface-100"
            >
              {loggedIn ? "Моят профил" : "Вход"}
              <Icon name={loggedIn ? "user" : "chevron-down"} size={20} className="-rotate-90 text-ink-500" />
            </Link>
            <LinkButton
              href="/auth/register?role=seller"
              size="lg"
              className="mt-4 h-14 w-full text-base"
              onClick={() => setMenuOpen(false)}
            >
              Създай магазин
            </LinkButton>
          </nav>
        </div>
      )}
    </header>
  );
}
