"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActive } from "@/components/dashboard/nav-items";
import { isVisible, type ComplexityMode } from "@/lib/complexity";

/**
 * Десктоп странична навигация (sidebar). На мобилно навигацията е в header-а
 * като burger меню (`MobileMenuButton`) — този компонент е скрит под md.
 */
export function DashboardNav({
  mode,
  pendingReviews = 0,
  pendingQuestions = 0,
}: {
  mode: ComplexityMode;
  pendingReviews?: number;
  pendingQuestions?: number;
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => isVisible(item.minMode, mode));

  /* Badge с чакащи — „Ревюта" (одобрение) и „Въпроси" (отговор). */
  const badgeFor = (href: string) => {
    if (href === "/dashboard/reviews" && pendingReviews > 0) return pendingReviews;
    if (href === "/dashboard/questions" && pendingQuestions > 0) return pendingQuestions;
    return null;
  };

  return (
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
  );
}
