/**
 * Каноничният базов URL на сайта. Единственият източник за metadataBase/sitemap/canonical.
 * Чете NEXT_PUBLIC_SITE_URL (прод: https://www.frizmoshops.bg) с fallback към vercel.app.
 * Без завършващ „/" (иначе `new URL(path, base)` дублира наклонени черти).
 *
 * ВАЖНО (одит #2 CACHE-03): layout.metadataBase и sitemap.ts ТРЯБВА да минават през тук.
 * Ако хардкодват домейна, задаването на NEXT_PUBLIC_SITE_URL само по себе си НЯМА да оправи
 * canonical/sitemap → Google консолидира индекса към грешен хост след смяна на домейна.
 */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = raw && raw !== "" ? raw : "https://frizmo-shops.vercel.app";
  return base.replace(/\/+$/, "");
}
