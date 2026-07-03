import Link from "next/link";
import { Icon, Logo } from "@/components/ui";

const PRODUCT_LINKS = [
  { href: "/shops", label: "Каталог с магазини" },
  { href: "/products", label: "Продукти" },
  { href: "/#pricing", label: "Цени" },
  { href: "/blog", label: "Блог" },
];

const LEGAL_LINKS = [
  { href: "/terms", label: "Условия за ползване" },
  { href: "/privacy", label: "Поверителност" },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-surface-200 bg-surface-0">
      {/* Основно тяло — бранд, линкове, контакти */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="max-w-xs">
          <Logo size={30} />
          <p className="mt-4 text-sm leading-relaxed text-ink-500">
            Платформата, с която всеки български бизнес създава свой онлайн магазин — бързо,
            лесно и без програмист.
          </p>
        </div>

        <nav aria-label="Продукт" className="text-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
            Продукт
          </p>
          <ul className="flex flex-col gap-2.5 text-ink-700">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-brand-600">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Правни" className="text-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
            Правни
          </p>
          <ul className="flex flex-col gap-2.5 text-ink-700">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-brand-600">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-500">
            Контакти
          </p>
          <ul className="flex flex-col gap-2.5 text-ink-700">
            <li>
              <a
                href="tel:+359877167007"
                className="flex items-center gap-2.5 transition-colors hover:text-brand-600"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name="phone" size={14} />
                </span>
                +359 87 716 7007
              </a>
            </li>
            <li>
              <a
                href="mailto:supportfrizmo@gmail.com"
                className="flex items-center gap-2.5 transition-colors hover:text-brand-600"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon name="mail" size={14} />
                </span>
                supportfrizmo@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Долна лента */}
      <div className="border-t border-surface-200">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-ink-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Frizmo Shops. Всички права запазени.</span>
          <span>Създадено с грижа за българските търговци.</span>
        </div>
      </div>
    </footer>
  );
}
