"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LinkButton, Logo } from "@/components/ui";

const nav = [
  { href: "/shops", label: "Магазини" },
  { href: "/products", label: "Продукти" },
  { href: "/blog", label: "Блог" },
  { href: "/#pricing", label: "Цени" },
];

/**
 * Marketing header: започва прозрачен върху хартията, а при скрол се
 * свива до плаващ pill (издигнат, с фон и сянка).
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    /* Първоначалното състояние — извън синхронния effect (react-compiler lint) */
    queueMicrotask(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <div
        className={`mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full px-4 transition-all duration-300 ${
          scrolled
            ? "border border-surface-200 bg-surface-0/90 shadow-card backdrop-blur"
            : "border border-transparent"
        }`}
      >
        <Logo className="shrink-0" />

        <nav aria-label="Основна навигация" className="flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-11 shrink-0 items-center rounded-full px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
            >
              {item.label}
            </Link>
          ))}
          <span className="hidden sm:block">
            <LinkButton href="/auth/register" size="sm">
              Създай магазин
            </LinkButton>
          </span>
        </nav>
      </div>
    </header>
  );
}
