import type { Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { StorefrontFooter } from "@/components/storefront/footer";
import { StorefrontHeader } from "@/components/storefront/header";
import { PreviewListener } from "@/components/storefront/preview-listener";
import { AnnouncementSection } from "@/components/storefront/sections/announcement";
import { getPublicCategories, getPublicShop } from "@/db/queries/storefront";
import { THEME_PRESETS, themeStyle } from "@/lib/themes";

interface StorefrontLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/** theme-color = фонът на темата на магазина — браузърният chrome/PWA лентата
 *  е в цвета на МАГАЗИНА, не на платформата (getPublicShop е react cache-нат,
 *  заявката се дели с layout-а). */
export async function generateViewport({
  params,
}: Pick<StorefrontLayoutProps, "params">): Promise<Viewport> {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) return {};
  return { themeColor: THEME_PRESETS[result.settings.theme]["--sf-bg"] };
}

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const { slug } = await params;
  const result = await getPublicShop(slug);
  if (!result) notFound();
  const { shop, settings, viewerIsOwner, viewingDraft } = result;
  /* Основните категории влизат в навигацията на header-а (ако са до 4). */
  const rootCategories = (await getPublicCategories(shop.id)).filter(
    (c) => c.parentId === null,
  );

  /* Announcement е topbar НАД header-а (site-wide), не секция в потока. */
  const announcement = settings.sections.find(
    (s) => s.type === "announcement" && s.enabled,
  );
  /* Начало с пълноекранен hero със снимка → header-ът ляга върху него. */
  const firstSection = settings.sections.find(
    (s) => s.enabled && s.type !== "announcement",
  );
  /* Overlay header важи само за poster (текст върху пълноекранна снимка). */
  const heroOverlay =
    firstSection?.type === "hero" &&
    firstSection.data.layout === "poster" &&
    firstSection.data.imagePaths.length > 0;
  /* Header вариант 2 (split bar) никога не ляга върху hero-то — той е винаги
     плътен в потока. 1 и 3 стават прозрачни върху poster снимката. */
  const headerOverlays = heroOverlay && settings.headerVariant !== 2;
  /* --sf-chrome: точната височина на всичко НАД hero-то — announcement лента
     (2.25rem при наличие) + header (4.75rem, само когато НЕ е overlay).
     Hero вариантите смятат min-h = 100dvh − chrome → покриват точно екрана. */
  const chromeRem = (announcement ? 2.25 : 0) + (headerOverlays ? 0 : 4.75);

  /* Скролбарът на документа е на <html> — тамошните CSS правила не виждат
     --sf-* (те живеят на вложения div). Затова инжектираме темовите тон-цветове
     директно на <html> с малък scoped <style>. Стойностите идват от темата. */
  const theme = themeStyle(settings) as Record<string, string>;
  const scrollbarCss = `html:has([data-storefront]){--sf-sb-thumb:${theme["--sf-muted"]};--sf-sb-thumb-hover:${settings.primaryColor}}`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: scrollbarCss }} />
      <div
      data-storefront
      style={
        {
          ...themeStyle(settings),
          "--sf-chrome": `${chromeRem}rem`,
        } as CSSProperties
      }
      /* overflow-x-clip: защитна мрежа срещу хоризонтален overflow (w-screen
         компенсира скролбара, елементи-бегълци). clip НЕ създава scroll
         контейнер → sticky header-ът продължава да работи (за разлика от hidden). */
      className="flex min-h-screen flex-col overflow-x-clip bg-(--sf-bg) text-(--sf-text)"
    >
      {viewerIsOwner && <PreviewListener />}
      {viewerIsOwner && (shop.status !== "published" || viewingDraft) && (
        <div className="bg-warning-600 px-4 py-2 text-center text-sm font-medium text-white">
          {shop.status !== "published"
            ? "Чернова — само ти виждаш тази страница."
            : "Виждаш незапазени промени от редактора."}{" "}
          <Link href="/dashboard/website" className="underline">
            Към редактора
          </Link>
        </div>
      )}
      {announcement?.type === "announcement" && (
        <AnnouncementSection data={announcement.data} />
      )}
      <StorefrontHeader
        shop={shop}
        settings={settings}
        rootCategories={rootCategories}
        heroOverlay={heroOverlay}
      />
      <main className="flex-1">{children}</main>
      <StorefrontFooter shop={shop} settings={settings} />
      </div>
    </>
  );
}
