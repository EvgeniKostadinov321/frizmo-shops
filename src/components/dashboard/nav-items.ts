import type { IconName } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

/** Единственият източник за навигацията в панела (sidebar + мобилно меню). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Табло", icon: "trending-up", exact: true },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "trending-up" },
  { href: "/dashboard/store", label: "Магазин", icon: "store" },
  { href: "/dashboard/products", label: "Продукти", icon: "store" },
  { href: "/dashboard/size-guides", label: "Таблици размери", icon: "ruler" },
  { href: "/dashboard/orders", label: "Поръчки", icon: "receipt" },
  { href: "/dashboard/reviews", label: "Ревюта", icon: "star" },
  { href: "/dashboard/questions", label: "Въпроси", icon: "help-circle" },
  { href: "/dashboard/categories", label: "Категории", icon: "palette" },
  { href: "/dashboard/website", label: "Уебсайт", icon: "image" },
  { href: "/dashboard/subscribers", label: "Абонати", icon: "megaphone" },
  { href: "/dashboard/coupons", label: "Промо кодове", icon: "tag" },
  { href: "/dashboard/fulfillment", label: "Плащане и доставка", icon: "trending-up" },
  { href: "/dashboard/billing", label: "Абонамент", icon: "wallet" },
];

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
