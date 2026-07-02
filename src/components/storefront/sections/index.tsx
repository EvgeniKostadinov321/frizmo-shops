import type { Category, Product, Shop } from "@/db";
import type { Section } from "@/schemas/site-settings";
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
}

export function renderSection(section: Section, ctx: SectionContext) {
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
        />
      );
    case "category-grid":
      return <CategoryGridSection key={section.id} data={section.data} ctx={ctx} />;
    case "promo-banner":
      return <PromoBannerSection key={section.id} data={section.data} />;
    case "image-text":
      return <ImageTextSection key={section.id} data={section.data} />;
    case "rich-text":
      return <RichTextSection key={section.id} data={section.data} />;
    case "testimonials":
      return <TestimonialsSection key={section.id} data={section.data} />;
    case "trust-badges":
      return <TrustBadgesSection key={section.id} data={section.data} />;
    case "gallery":
      return <GallerySection key={section.id} data={section.data} />;
    case "faq":
      return <FaqSection key={section.id} data={section.data} />;
    case "contact-map":
      return <ContactMapSection key={section.id} data={section.data} ctx={ctx} />;
    case "socials":
      return <SocialsSection key={section.id} data={section.data} ctx={ctx} />;
  }
}
