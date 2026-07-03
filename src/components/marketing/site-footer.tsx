import Link from "next/link";
import { FlagBg, Logo } from "@/components/ui";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-surface-200 bg-surface-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <Logo size={28} />
          <p className="mt-3 text-sm text-ink-500">
            Платформата, с която всеки български бизнес създава свой онлайн магазин — бързо,
            лесно и без програмист.
          </p>
        </div>
        <nav aria-label="Продукт" className="text-sm">
          <p className="mb-2 font-medium text-ink-900">Продукт</p>
          <ul className="flex flex-col gap-1.5 text-ink-500">
            <li><Link href="/shops" className="hover:text-ink-900">Каталог с магазини</Link></li>
            <li><Link href="/products" className="hover:text-ink-900">Продукти</Link></li>
            <li><Link href="/#pricing" className="hover:text-ink-900">Цени</Link></li>
            <li><Link href="/blog" className="hover:text-ink-900">Блог</Link></li>
          </ul>
        </nav>
        <nav aria-label="Правни" className="text-sm">
          <p className="mb-2 font-medium text-ink-900">Правни</p>
          <ul className="flex flex-col gap-1.5 text-ink-500">
            <li><Link href="/terms" className="hover:text-ink-900">Условия за ползване</Link></li>
            <li><Link href="/privacy" className="hover:text-ink-900">Поверителност</Link></li>
          </ul>
        </nav>
      </div>
      <div className="flex items-center justify-center gap-1.5 border-t border-surface-100 py-4 text-xs text-ink-500">
        © {new Date().getFullYear()} Frizmo Shops · Създадено в България
        <FlagBg className="h-3 w-auto" />
      </div>
    </footer>
  );
}
