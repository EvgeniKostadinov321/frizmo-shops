import type { IconName } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Ф2: минимален режим на сложност, при който секцията се показва (0=hobby, 1=business, 2=full). */
  minMode: number;
}

/** Единственият източник за навигацията в панела (sidebar + мобилно меню). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Табло", icon: "trending-up", exact: true, minMode: 0 },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "trending-up", minMode: 1 },
  { href: "/dashboard/store", label: "Магазин", icon: "store", minMode: 0 },
  { href: "/dashboard/products", label: "Продукти", icon: "store", minMode: 0 },
  { href: "/dashboard/size-guides", label: "Таблици размери", icon: "ruler", minMode: 2 },
  { href: "/dashboard/orders", label: "Поръчки", icon: "receipt", minMode: 0 },
  { href: "/dashboard/reviews", label: "Ревюта", icon: "star", minMode: 1 },
  { href: "/dashboard/questions", label: "Въпроси", icon: "help-circle", minMode: 2 },
  { href: "/dashboard/categories", label: "Категории", icon: "palette", minMode: 1 },
  { href: "/dashboard/website", label: "Уебсайт", icon: "image", minMode: 0 },
  { href: "/dashboard/subscribers", label: "Абонати", icon: "megaphone", minMode: 2 },
  { href: "/dashboard/coupons", label: "Промо кодове", icon: "tag", minMode: 1 },
  { href: "/dashboard/fulfillment", label: "Плащане и доставка", icon: "trending-up", minMode: 0 },
  { href: "/dashboard/billing", label: "Такси", icon: "wallet", minMode: 0 },
];

export function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
