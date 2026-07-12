"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { seg: "", label: "Табло" },
  { seg: "/orders", label: "Поръчки" },
  { seg: "/addresses", label: "Адреси" },
  { seg: "/settings", label: "Настройки" },
];

/** Табова навигация в купувачския профил (само --sf-* токени). */
export function AccountNav({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Профил навигация"
      className="flex gap-1 overflow-x-auto border-b border-(--sf-border)"
    >
      {ITEMS.map((it) => {
        const href = `${base}/account${it.seg}`;
        const active = path === href;
        return (
          <Link
            key={it.seg}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-b-2 border-(--sf-primary) text-(--sf-text)"
                : "text-(--sf-muted) hover:text-(--sf-text)"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
