import Link from "next/link";
import { LinkButton } from "@/components/ui";

const nav = [
  { href: "/shops", label: "Магазини" },
  { href: "/products", label: "Продукти" },
  { href: "/blog", label: "Блог" },
  { href: "/#pricing", label: "Цени" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-200 bg-surface-0/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-control bg-brand-600 text-sm font-bold text-white"
          >
            FS
          </span>
          <span className="text-lg font-bold text-ink-900">Frizmo Shops</span>
        </Link>

        <nav aria-label="Основна навигация" className="flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-11 shrink-0 items-center rounded-control px-3 text-sm font-medium text-ink-700 transition-colors hover:bg-surface-100 hover:text-ink-900"
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
