"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { seg: "", label: "Табло" },
  { seg: "/orders", label: "Поръчки" },
  { seg: "/favorites", label: "Любими" },
  { seg: "/addresses", label: "Адреси" },
  { seg: "/settings", label: "Настройки" },
];

/** Табова навигация в глобалния купувачки профил (платформени токени). */
export function AccountNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Профил навигация"
      className="flex gap-1 overflow-x-auto border-b border-surface-200"
    >
      {ITEMS.map((it) => {
        const href = `/account${it.seg}`;
        const active = path === href;
        return (
          <Link
            key={it.seg}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-brand-600 text-ink-900"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
