import type { Section } from "@/schemas/site-settings";

/** Контекст за преценка дали секция ще е празна на живо. */
export interface SectionWarningContext {
  productCount: number;
  categoryCount: number;
  hasSocials: boolean;
  hasAddress: boolean;
}

/**
 * Връща предупреждение, ако секцията НЯМА да се покаже на живо въпреки че е
 * активна (данните ѝ идват отвън или полетата са празни). null = ще се покаже.
 * Отразява точно `return null` условията в storefront секциите — единна причина
 * защо нещо „изчезва", вместо тихо скриване.
 */
export function sectionWarning(
  section: Section,
  ctx: SectionWarningContext,
): string | null {
  switch (section.type) {
    case "promo-banner":
      if (!section.data.title && !section.data.text) {
        return "Няма да се покаже: добави заглавие или текст.";
      }
      return null;
    case "socials":
      if (!ctx.hasSocials) {
        return "Няма да се покаже: добави социални мрежи в таб „Магазин“.";
      }
      return null;
    case "featured-products":
      if (ctx.productCount === 0) {
        return "Няма да се покаже: нямаш продукти още.";
      }
      return null;
    case "category-grid":
      if (ctx.categoryCount === 0) {
        return "Няма да се покаже: нямаш категории още.";
      }
      return null;
    case "trust-badges":
      if (section.data.items.every((i) => !i.text.trim())) {
        return "Няма да се покаже: добави поне един елемент с текст.";
      }
      return null;
    case "testimonials":
      if (section.data.items.length === 0) {
        return "Няма да се покаже: добави поне един отзив.";
      }
      return null;
    case "faq":
      if (section.data.items.length === 0) {
        return "Няма да се покаже: добави поне един въпрос.";
      }
      return null;
    case "gallery":
      if (section.data.imagePaths.length === 0) {
        return "Няма да се покаже: добави поне една снимка.";
      }
      return null;
    case "announcement":
      if (!section.data.text) {
        return "Няма да се покаже: добави текст на съобщението.";
      }
      return null;
    case "contact-map":
      if (section.data.showMap && !ctx.hasAddress) {
        return "Картата няма да се покаже: добави адрес в таб „Магазин“.";
      }
      return null;
    default:
      return null;
  }
}
