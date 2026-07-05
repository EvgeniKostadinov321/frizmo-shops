import Link from "next/link";
import type { Shop } from "@/db";
import { formatWorkingHours, parseWorkingHours } from "@/lib/working-hours";
import type { SiteSettings } from "@/schemas/site-settings";

interface StorefrontFooterProps {
  shop: Shop;
  settings: SiteSettings;
}

/** Заглавие на footer колона. */
function ColTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.22em] opacity-60">
      {children}
    </h3>
  );
}

/**
 * Богат тъмен footer (инверсия като отзивите): лого + описание вляво,
 * колони Магазин/Контакти/Последвай ни, hairline лента отдолу.
 */
export function StorefrontFooter({ shop, settings }: StorefrontFooterProps) {
  const base = `/s/${shop.slug}`;
  const socialLinks = (shop.socialLinks as { facebook?: string; instagram?: string } | null) ?? {};
  const hours = formatWorkingHours(parseWorkingHours(shop.workingHours));
  const hasSocials = Boolean(socialLinks.facebook || socialLinks.instagram);

  return (
    <footer className="mt-auto bg-(--sf-text) text-(--sf-bg)">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:py-20 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="font-(family-name:--sf-font-heading) text-2xl" style={{ fontWeight: "var(--sf-heading-weight)" }}>
            {shop.name}
          </p>
          {settings.footerText && (
            <p className="mt-3 leading-relaxed opacity-70">{settings.footerText}</p>
          )}
        </div>

        <nav aria-label="Магазин">
          <ColTitle>Магазин</ColTitle>
          <ul className="flex flex-col gap-2.5">
            <li>
              <Link href={`${base}/products`} className="opacity-80 transition-opacity hover:opacity-100">
                Продукти
              </Link>
            </li>
            <li>
              <Link href={`${base}/about`} className="opacity-80 transition-opacity hover:opacity-100">
                За нас
              </Link>
            </li>
            <li>
              <Link href={`${base}/contact`} className="opacity-80 transition-opacity hover:opacity-100">
                Контакти
              </Link>
            </li>
            <li>
              <Link href={`${base}/terms`} className="opacity-80 transition-opacity hover:opacity-100">
                Условия за пазаруване
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <ColTitle>Контакти</ColTitle>
          <ul className="flex flex-col gap-2.5">
            {shop.phone && (
              <li>
                <a href={`tel:${shop.phone}`} className="opacity-80 transition-opacity hover:opacity-100">
                  {shop.phone}
                </a>
              </li>
            )}
            {shop.email && (
              <li>
                <a href={`mailto:${shop.email}`} className="break-all opacity-80 transition-opacity hover:opacity-100">
                  {shop.email}
                </a>
              </li>
            )}
            {(shop.address || shop.city) && (
              <li className="opacity-80">{[shop.address, shop.city].filter(Boolean).join(", ")}</li>
            )}
            {hours.map((line) => (
              <li key={line} className="text-sm opacity-60">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {hasSocials && (
          <div>
            <ColTitle>Последвай ни</ColTitle>
            <ul className="flex flex-col gap-2.5">
              {socialLinks.facebook && (
                <li>
                  <a
                    href={socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-80 transition-opacity hover:opacity-100"
                  >
                    Facebook
                  </a>
                </li>
              )}
              {socialLinks.instagram && (
                <li>
                  <a
                    href={socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-80 transition-opacity hover:opacity-100"
                  >
                    Instagram
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-(--sf-bg)/15">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm opacity-60">
          <span>
            © {shop.name}
          </span>
          <span>
            Създадено с{" "}
            <Link href="/" className="underline transition-opacity hover:opacity-80">
              Frizmo Shops
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
