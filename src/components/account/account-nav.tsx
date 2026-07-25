"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Icon, type IconName } from "@/components/ui";

const ITEMS: { seg: string; label: string; icon: IconName }[] = [
  { seg: "", label: "Табло", icon: "layout-panel" },
  { seg: "/orders", label: "Поръчки", icon: "receipt" },
  { seg: "/favorites", label: "Любими", icon: "heart" },
  { seg: "/addresses", label: "Адреси", icon: "map-pin" },
  { seg: "/settings", label: "Настройки", icon: "user" },
];

/**
 * Навигация в глобалния купувачки профил (платформени токени).
 * Мобилно: хоризонтална табова лента отгоре. Десктоп: вертикален sidebar
 * (по идиома на dashboard-а) — съдържанието получава цялата останала ширина.
 */
export function AccountNav({ hasShop = false }: { hasShop?: boolean }) {
  const path = usePathname();
  return (
    <>
      {/* Мобилно — хоризонтални табове */}
      <nav
        aria-label="Профил навигация"
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-surface-200 px-4 md:hidden"
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
        {/* Реципрочното на „Пазарувам" в dashboard хедъра: винаги има път към
            продавашкия контекст (без магазин dashboard-ът води към onboarding). */}
        <Link
          href="/dashboard"
          className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {hasShop ? "Моят магазин" : "Продавам"}
        </Link>
        {/* Изход — най-вдясно в мобилната лента, отделен визуално */}
        <form action={signOut.bind(null, "/")} className="ml-auto shrink-0">
          <button
            type="submit"
            className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-ink-500 hover:text-ink-900"
          >
            Изход
          </button>
        </form>
      </nav>

      {/* Десктоп — вертикален sidebar */}
      <nav aria-label="Профил навигация" className="hidden md:flex md:flex-col md:gap-1">
        {ITEMS.map((it) => {
          const href = `/account${it.seg}`;
          const active = path === href;
          return (
            <Link
              key={it.seg}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-surface-100 text-ink-900"
                  : "text-ink-500 hover:bg-surface-50 hover:text-ink-900"
              }`}
            >
              <Icon name={it.icon} size={18} className="shrink-0" />
              {it.label}
            </Link>
          );
        })}
        {/* Реципрочното на „Пазарувам" в dashboard хедъра — ВИНАГИ има път към
            продавашкия контекст: с магазин → таблото; без магазин dashboard-ът
            сам води към onboarding (покана да станеш продавач). */}
        <Link
          href="/dashboard"
          className="mt-1 flex items-center gap-2.5 rounded-control border-t border-surface-200 px-3 pt-3 pb-2 text-sm font-medium text-brand-600 transition-colors hover:bg-surface-50 hover:text-brand-700"
        >
          <Icon name="store" size={18} className="shrink-0" />
          {hasShop ? "Моят магазин" : "Продавам"}
        </Link>
        {/* Изход — отделен най-долу, по идиома на dashboard-а */}
        <form action={signOut.bind(null, "/")} className="mt-1 border-t border-surface-200 pt-1">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:bg-surface-50 hover:text-ink-900"
          >
            <Icon name="x" size={18} className="shrink-0" />
            Изход
          </button>
        </form>
      </nav>
    </>
  );
}
