"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Табло", exact: true },
  { href: "/dashboard/store", label: "Магазин" },
  { href: "/dashboard/products", label: "Продукти" },
  { href: "/dashboard/categories", label: "Категории" },
  { href: "/dashboard/website", label: "Уебсайт" },
  { href: "/dashboard/fulfillment", label: "Плащане и доставка" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основна навигация"
      className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible"
    >
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-11 shrink-0 items-center rounded-control px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-700 hover:bg-surface-100 hover:text-ink-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
