import {
  sectionSchema,
  siteSettingsSchema,
  type Section,
  type SectionType,
  type SiteSettings,
} from "@/schemas/site-settings";

interface SectionDef {
  label: string;
  icon: string;
  /** За гейта по план в План 6; сега всички са достъпни (trial = Pro). */
  planTier: "starter" | "pro";
  defaultData: Record<string, unknown>;
}

export const SECTION_DEFS: Record<SectionType, SectionDef> = {
  hero: {
    label: "Hero (голямо заглавие)",
    icon: "🖼️",
    planTier: "starter",
    defaultData: { layout: "full", title: "", subtitle: "", ctaLabel: "", ctaHref: "", imagePaths: [] },
  },
  announcement: {
    label: "Лента-съобщение",
    icon: "📣",
    planTier: "pro",
    defaultData: { text: "", href: "" },
  },
  "featured-products": {
    label: "Избрани продукти",
    icon: "⭐",
    planTier: "starter",
    defaultData: { title: "Избрани продукти", mode: "newest", productIds: [] },
  },
  "category-grid": {
    label: "Категории",
    icon: "🗂️",
    planTier: "starter",
    defaultData: { title: "Разгледай по категория", categoryIds: [] },
  },
  "promo-banner": {
    label: "Промо банер",
    icon: "🏷️",
    planTier: "pro",
    defaultData: { title: "", text: "", ctaLabel: "", ctaHref: "", imagePath: "" },
  },
  "image-text": {
    label: "Снимка + текст",
    icon: "📷",
    planTier: "starter",
    defaultData: { title: "", text: "", imagePath: "", imageSide: "left" },
  },
  "rich-text": {
    label: "Текстов блок",
    icon: "📝",
    planTier: "starter",
    defaultData: { title: "", text: "" },
  },
  testimonials: {
    label: "Отзиви на клиенти",
    icon: "💬",
    planTier: "pro",
    defaultData: { title: "Какво казват клиентите", items: [] },
  },
  "trust-badges": {
    label: "Доверие (badges)",
    icon: "✅",
    planTier: "pro",
    defaultData: { items: [] },
  },
  gallery: {
    label: "Галерия",
    icon: "🖼",
    planTier: "pro",
    defaultData: { title: "Галерия", imagePaths: [] },
  },
  faq: {
    label: "Често задавани въпроси",
    icon: "❓",
    planTier: "pro",
    defaultData: { title: "Често задавани въпроси", items: [] },
  },
  "contact-map": {
    label: "Контакти и карта",
    icon: "📍",
    planTier: "starter",
    defaultData: { title: "Къде да ни намериш", showMap: true },
  },
  socials: {
    label: "Социални мрежи",
    icon: "🔗",
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
