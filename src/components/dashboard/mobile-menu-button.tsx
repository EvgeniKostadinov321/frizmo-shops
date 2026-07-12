"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/actions/auth";
import { Icon } from "@/components/ui";
import { NAV_ITEMS, isActive } from "@/components/dashboard/nav-items";
import { isVisible, type ComplexityMode } from "@/lib/complexity";

/**
 * Мобилен burger триггер (в header-а) + fullscreen overlay меню. Съдържа
 * всички страници + Изход; светла/тъмна остава извън менюто в header-а.
 * Десктоп навигацията е отделно (`DashboardNav`, страничен sidebar).
 */
export function MobileMenuButton({
  mode,
  pendingReviews = 0,
  pendingQuestions = 0,
}: {
  mode: ComplexityMode;
  pendingReviews?: number;
  pendingQuestions?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => isVisible(item.minMode, mode));

  const badgeFor = (href: string) => {
    if (href === "/dashboard/reviews" && pendingReviews > 0) return pendingReviews;
    if (href === "/dashboard/questions" && pendingQuestions > 0) return pendingQuestions;
    return null;
  };

  /* Заключи скрола + Escape затваря, докато fullscreen менюто е отворено. */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Отвори менюто"
        aria-expanded={open}
        className="flex size-11 items-center justify-center rounded-control text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900 md:hidden"
      >
        <Icon name="menu" size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-50 md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-surface-200 px-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-500">
              Меню
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Затвори менюто"
              className="flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-surface-100"
            >
              <Icon name="x" size={22} />
            </button>
          </div>

          <nav
            aria-label="Основна навигация"
            className="flex flex-1 flex-col gap-1 overflow-y-auto p-4"
          >
            {items.map((item) => {
              const a = isActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={a ? "page" : undefined}
                  className={`flex h-12 items-center gap-3 rounded-control px-4 text-base font-medium transition-colors ${
                    a ? "bg-brand-50 text-brand-700" : "text-ink-900 hover:bg-surface-100"
                  }`}
                >
                  <Icon name={item.icon} size={20} className={a ? "text-brand-600" : "text-ink-500"} />
                  {item.label}
                  {badgeFor(item.href) !== null && (
                    <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold leading-5 text-surface-0">
                      {badgeFor(item.href)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Изход — най-долу, отделен с hairline */}
          <div className="border-t border-surface-200 p-4">
            <form action={signOut}>
              <button
                type="submit"
                className="flex h-12 w-full items-center gap-3 rounded-control px-4 text-base font-medium text-ink-700 transition-colors hover:bg-surface-100"
              >
                <Icon name="x" size={20} className="text-ink-500" />
                Изход
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
