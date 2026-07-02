import Image from "next/image";
import Link from "next/link";
import type { Shop } from "@/db";
import { publicImageUrl } from "@/lib/storage";
import type { SiteSettings } from "@/schemas/site-settings";
import { CartButton } from "./cart-button";

interface StorefrontHeaderProps {
  shop: Shop;
  settings: SiteSettings;
}

export function StorefrontHeader({ shop, settings }: StorefrontHeaderProps) {
  const base = `/s/${shop.slug}`;
  const nav = [
    { href: base, label: "Начало" },
    { href: `${base}/products`, label: "Продукти" },
    { href: `${base}/about`, label: "За нас" },
    { href: `${base}/contact`, label: "Контакти" },
  ];
  const centered = settings.headerLayout === "logo-center";

  return (
    <header className="border-b border-(--sf-border) bg-(--sf-bg)">
      <div
        className={`mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 ${
          centered ? "items-center" : "sm:flex-row sm:items-center sm:justify-between"
        }`}
      >
        <Link href={base} className="flex items-center gap-3">
          {shop.logoPath ? (
            <Image
              src={publicImageUrl(shop.logoPath)}
              alt={`Лого на ${shop.name}`}
              width={44}
              height={44}
              className="size-11 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-full bg-(--sf-primary) text-lg font-bold text-white"
            >
              {shop.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span
            className="text-xl text-(--sf-text)"
            style={{ fontWeight: "var(--sf-heading-weight)" as never }}
          >
            {shop.name}
          </span>
        </Link>

        <nav aria-label="Навигация на магазина" className="flex items-center gap-1 overflow-x-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-11 shrink-0 items-center rounded-(--sf-radius) px-3 text-sm font-medium text-(--sf-text) transition-opacity hover:opacity-70"
            >
              {item.label}
            </Link>
          ))}
          <CartButton shopId={shop.id} base={base} />
        </nav>
      </div>
    </header>
  );
}
