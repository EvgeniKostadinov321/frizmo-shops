import { type IconName } from "@/components/ui/icon";
import {
  sectionSchema,
  siteSettingsSchema,
  type Section,
  type SectionType,
  type SiteSettings,
} from "@/schemas/site-settings";

interface SectionDef {
  label: string;
  icon: IconName;
  /** За гейта по план в План 6; сега всички са достъпни (trial = Pro). */
  planTier: "starter" | "pro";
  defaultData: Record<string, unknown>;
}

export const SECTION_DEFS: Record<SectionType, SectionDef> = {
  hero: {
    label: "Hero (голямо заглавие)",
    icon: "layout-panel",
    planTier: "starter",
    defaultData: { layout: "split", title: "", subtitle: "", ctaLabel: "", ctaHref: "", imagePaths: [] },
  },
  announcement: {
    label: "Лента-съобщение",
    icon: "megaphone",
    planTier: "pro",
    defaultData: { text: "", href: "" },
  },
  "featured-products": {
    label: "Избрани продукти",
    icon: "star",
    planTier: "starter",
    defaultData: { title: "Избрани продукти", mode: "newest", productIds: [] },
  },
  "category-grid": {
    label: "Категории",
    icon: "grid",
    planTier: "starter",
    defaultData: { title: "Разгледай по категория", categoryIds: [] },
  },
  "promo-banner": {
    label: "Промо банер",
    icon: "tag",
    planTier: "pro",
    defaultData: { title: "", text: "", ctaLabel: "", ctaHref: "", imagePath: "" },
  },
  "image-text": {
    label: "Снимка + текст",
    icon: "image",
    planTier: "starter",
    defaultData: { title: "", text: "", imagePath: "", imageSide: "left" },
  },
  "rich-text": {
    label: "Текстов блок",
    icon: "text",
    planTier: "starter",
    defaultData: { title: "", text: "" },
  },
  testimonials: {
    label: "Отзиви на клиенти",
    icon: "quote",
    planTier: "pro",
    defaultData: { title: "Какво казват клиентите", items: [] },
  },
  "trust-badges": {
    label: "Доверие (badges)",
    icon: "shield-check",
    planTier: "pro",
    defaultData: { items: [] },
  },
  gallery: {
    label: "Галерия",
    icon: "images",
    planTier: "pro",
    defaultData: { title: "Галерия", imagePaths: [] },
  },
  faq: {
    label: "Често задавани въпроси",
    icon: "help-circle",
    planTier: "pro",
    defaultData: { title: "Често задавани въпроси", items: [] },
  },
  "contact-map": {
    label: "Контакти и карта",
    icon: "map-pin",
    planTier: "starter",
    defaultData: { title: "Къде да ни намериш", showMap: true },
  },
  socials: {
    label: "Социални мрежи",
    icon: "link",
    planTier: "starter",
    defaultData: { title: "Последвай ни" },
  },
};

/** Фабрика за нова секция от даден тип (валидирана през схемата). */
export function newSection(type: SectionType): Section {
  return sectionSchema.parse({
    id: crypto.randomUUID(),
    type,
    enabled: true,
    data: SECTION_DEFS[type].defaultData,
  });
}

/** Начален набор секции при първо отваряне на таб „Уебсайт". */
export function defaultSections(shopName: string): Section[] {
  const hero = newSection("hero");
  if (hero.type === "hero") {
    hero.data.title = shopName;
    hero.data.subtitle = "Добре дошли в нашия онлайн магазин!";
  }
  return [hero, newSection("featured-products"), newSection("contact-map")];
}

/** Начални настройки за магазин без запис в site_settings. */
export function defaultSiteSettings(shopName: string): SiteSettings {
  return { ...siteSettingsSchema.parse({}), sections: defaultSections(shopName) };
}
