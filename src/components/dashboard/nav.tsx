"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui";

const items: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: "/dashboard", label: "Табло", icon: "trending-up", exact: true },
  { href: "/dashboard/store", label: "Магазин", icon: "store" },
  { href: "/dashboard/products", label: "Продукти", icon: "store" },
  { href: "/dashboard/orders", label: "Поръчки", icon: "receipt" },
  { href: "/dashboard/reviews", label: "Ревюта", icon: "star" },
  { href: "/dashboard/categories", label: "Категории", icon: "palette" },
  { href: "/dashboard/website", label: "Уебсайт", icon: "image" },
  { href: "/dashboard/subscribers", label: "Абонати", icon: "megaphone" },
  { href: "/dashboard/coupons", label: "Промо кодове", icon: "tag" },
  { href: "/dashboard/fulfillment", label: "Плащане и доставка", icon: "trending-up" },
];

function isActive(pathname: string, item: (typeof items)[number]) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function DashboardNav({ pendingReviews = 0 }: { pendingReviews?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /* Badge с чакащи за одобрение (S1) — само на „Ревюта". */
  const badgeFor = (href: string) =>
    href === "/dashboard/reviews" && pendingReviews > 0 ? pendingReviews : null;

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

  const active = items.find((i) => isActive(pathname, i));

  return (
    <>
      {/* Мобилно: бутон „текуща страница" отваря fullscreen меню */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Отвори менюто"
        className="flex h-11 w-full items-center justify-between rounded-control border border-surface-200 bg-surface-0 px-4 text-sm font-medium text-ink-900 md:hidden"
      >
        <span className="flex items-center gap-2">
          <Icon name="menu" size={18} />
          {active?.label ?? "Меню"}
        </span>
        <Icon name="chevron-down" size={18} className="text-ink-500" />
      </button>

      {/* Fullscreen overlay меню (мобилно) */}
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
          <nav aria-label="Основна навигация" className="flex flex-col gap-1 p-4">
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
        </div>
      )}

      {/* Десктоп: вертикална странична навигация */}
      <nav aria-label="Основна навигация" className="hidden flex-col gap-1 md:flex">
        {items.map((item) => {
          const a = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={a ? "page" : undefined}
              className={`flex h-11 items-center rounded-control px-4 text-sm font-medium transition-colors ${
                a ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-surface-100 hover:text-ink-900"
              }`}
            >
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
    </>
  );
}
