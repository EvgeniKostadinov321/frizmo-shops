import type { Category, Product, Shop } from "@/db";
import type { CategoryCover } from "@/db/queries/storefront";
import type { Section, SectionType } from "@/schemas/site-settings";
import type { SectionTone } from "./shared";
import { AnnouncementSection } from "./announcement";
import { CategoryGridSection } from "./category-grid";
import { ContactMapSection } from "./contact-map";
import { FaqSection } from "./faq";
import { FeaturedProductsSection } from "./featured-products";
import { GallerySection } from "./gallery";
import { HeroSection } from "./hero";
import { ImageTextSection } from "./image-text";
import { PromoBannerSection } from "./promo-banner";
import { RichTextSection } from "./rich-text";
import { SocialsSection } from "./socials";
import { TestimonialsSection } from "./testimonials";
import { TrustBadgesSection } from "./trust-badges";

export interface SectionContext {
  shop: Shop;
  /** Базов път на магазина: /s/{slug} */
  base: string;
  /** Заредени продукти per секция (featured-products), ключ = section.id */
  productsBySection: Record<string, Product[]>;
  categories: Category[];
  /** Корици за категорийните карти (снимка + брой), ключ = category.id */
  categoryCovers: Record<string, CategoryCover>;
}

/** Секции, участващи в тоналното редуване (bg ↔ surface). hero/announcement/
 *  promo-banner имат собствени фонове и не броят в ритъма. */
const RHYTHM_SECTIONS: ReadonlySet<SectionType> = new Set([
  "featured-products",
  "category-grid",
  "rich-text",
  "gallery",
  "faq",
  "contact-map",
  "socials",
] satisfies SectionType[]);

/**
 * Рендерира всички секции с автоматично редуване на тона: секциите от ритъма
 * се редуват bg → surface → bg… — вертикален ритъм без ръчна настройка.
 */
export function renderSections(sections: Section[], ctx: SectionContext) {
  let rhythmIndex = 0;
  return sections.map((section) => {
    if (!section.enabled) return null;
    /* Announcement се рендерира от layout-а като topbar над header-а. */
    if (section.type === "announcement") return null;
    let tone: SectionTone = "default";
    if (RHYTHM_SECTIONS.has(section.type)) {
      tone = rhythmIndex % 2 === 1 ? "surface" : "default";
      rhythmIndex += 1;
    }
    return renderSection(section, ctx, tone);
  });
}

export function renderSection(
  section: Section,
  ctx: SectionContext,
  tone: SectionTone = "default",
) {
  if (!section.enabled) return null;

  switch (section.type) {
    case "hero":
      return <HeroSection key={section.id} data={section.data} ctx={ctx} />;
    case "announcement":
      return <AnnouncementSection key={section.id} data={section.data} />;
    case "featured-products":
      return (
        <FeaturedProductsSection
          key={section.id}
          data={section.data}
          products={ctx.productsBySection[section.id] ?? []}
          ctx={ctx}
          tone={tone}
        />
      );
    case "category-grid":
      return <CategoryGridSection key={section.id} data={section.data} ctx={ctx} tone={tone} />;
    case "promo-banner":
      return <PromoBannerSection key={section.id} data={section.data} />;
    case "image-text":
      return <ImageTextSection key={section.id} data={section.data} />;
    case "rich-text":
      return <RichTextSection key={section.id} data={section.data} tone={tone} />;
    case "testimonials":
      /* самотонира се (инверсия) — не участва в bg/surface ритъма */
      return <TestimonialsSection key={section.id} data={section.data} />;
    case "trust-badges":
      return <TrustBadgesSection key={section.id} data={section.data} />;
    case "gallery":
      return <GallerySection key={section.id} data={section.data} tone={tone} />;
    case "faq":
      return <FaqSection key={section.id} data={section.data} tone={tone} />;
    case "contact-map":
      return <ContactMapSection key={section.id} data={section.data} ctx={ctx} tone={tone} />;
    case "socials":
      return <SocialsSection key={section.id} data={section.data} ctx={ctx} tone={tone} />;
  }
}
