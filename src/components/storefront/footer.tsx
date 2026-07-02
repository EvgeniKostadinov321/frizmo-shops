import Link from "next/link";
import type { Shop } from "@/db";
import { formatWorkingHours, parseWorkingHours } from "@/lib/working-hours";
import type { SiteSettings } from "@/schemas/site-settings";

interface StorefrontFooterProps {
  shop: Shop;
  settings: SiteSettings;
}

export function StorefrontFooter({ shop, settings }: StorefrontFooterProps) {
  const base = `/s/${shop.slug}`;
  const socialLinks = (shop.socialLinks as { facebook?: string; instagram?: string } | null) ?? {};
  const hours = formatWorkingHours(parseWorkingHours(shop.workingHours));

  return (
    <footer className="mt-auto border-t border-(--sf-border) bg-(--sf-surface)">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <h2
            className="mb-2 text-(--sf-text)"
            style={{ fontWeight: "var(--sf-heading-weight)" as never }}
          >
            {shop.name}
          </h2>
          {settings.footerText && (
            <p className="text-sm text-(--sf-muted)">{settings.footerText}</p>
          )}
          <p className="mt-3 text-sm">
            <Link href={`${base}/terms`} className="text-(--sf-muted) underline hover:opacity-70">
              Условия за доставка и връщане
            </Link>
          </p>
        </div>

        <div className="text-sm text-(--sf-muted)">
          <h3 className="mb-2 font-medium text-(--sf-text)">Контакти</h3>
          {shop.phone && (
            <p>
              <a href={`tel:${shop.phone}`} className="hover:opacity-70">
                {shop.phone}
              </a>
            </p>
          )}
          {shop.email && (
            <p>
              <a href={`mailto:${shop.email}`} className="hover:opacity-70">
                {shop.email}
              </a>
            </p>
          )}
          {(shop.address || shop.city) && (
            <p>{[shop.address, shop.city].filter(Boolean).join(", ")}</p>
          )}
          <div className="mt-2 flex gap-3">
            {socialLinks.facebook && (
              <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                Facebook
              </a>
            )}
            {socialLinks.instagram && (
              <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-70">
                Instagram
              </a>
            )}
          </div>
        </div>

        <div className="text-sm text-(--sf-muted)">
          <h3 className="mb-2 font-medium text-(--sf-text)">Работно време</h3>
          {hours.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-(--sf-border) py-4 text-center text-xs text-(--sf-muted)">
        Създадено с{" "}
        <Link href="/" className="underline hover:opacity-70">
          Frizmo Shops
        </Link>
      </div>
    </footer>
  );
}
