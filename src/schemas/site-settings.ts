import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Невалиден цвят");
const shortText = (max: number) => z.string().trim().max(max).default("");

/* Всяка секция: { id, type, enabled, data } */
const base = { id: z.uuid(), enabled: z.boolean().default(true) };

export const TRUST_BADGE_ICONS = ["truck", "shield", "return", "phone", "leaf", "star"] as const;

export const sectionSchemas = {
  hero: z.object({
    ...base,
    type: z.literal("hero"),
    data: z.object({
      /* Три композиции + legacy: split (текст|снимка с рамка), poster (текст
         върху цяла снимка, editorial), statement (плътен цветен блок, чиста
         типография + marquee). Старите стойности се пренасочват без миграция. */
      layout: z.preprocess(
        (v) =>
          v === "full" || v === "slideshow" || v === "duo"
            ? "poster"
            : v === "frame"
              ? "statement"
              : v,
        z.enum(["split", "poster", "statement"]).default("split"),
      ),
      title: shortText(120),
      subtitle: shortText(200),
      ctaLabel: shortText(40),
      ctaHref: shortText(300),
      imagePaths: z.array(z.string().max(300)).max(5).default([]),
    }),
  }),
  announcement: z.object({
    ...base,
    type: z.literal("announcement"),
    data: z.object({ text: shortText(120), href: shortText(300) }),
  }),
  "featured-products": z.object({
    ...base,
    type: z.literal("featured-products"),
    data: z.object({
      /* Композиция: 1 = адаптивен grid с карти, 2 = editorial списък
         (голяма снимка + редове, hover сменя снимката). */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(80),
      mode: z.enum(["manual", "newest", "promo"]).default("newest"),
      productIds: z.array(z.uuid()).max(8).default([]),
    }),
  }),
  "category-grid": z.object({
    ...base,
    type: z.literal("category-grid"),
    data: z.object({
      /* Композиция: 1 = full-bleed мозайка със снимки, 2 = номериран
         списък-меню (editorial, hover показва снимката). */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(80),
      categoryIds: z.array(z.uuid()).max(8).default([]),
    }),
  }),
  "promo-banner": z.object({
    ...base,
    type: z.literal("promo-banner"),
    data: z.object({
      title: shortText(100),
      text: shortText(200),
      ctaLabel: shortText(40),
      ctaHref: shortText(300),
      imagePath: z.string().max(300).default(""),
    }),
  }),
  "image-text": z.object({
    ...base,
    type: z.literal("image-text"),
    data: z.object({
      /* Композиция: 1 = снимка до текста (разделени колони), 2 = текст-карта,
         застъпваща голямата снимка (дълбочина). */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(100),
      text: shortText(2000),
      imagePath: z.string().max(300).default(""),
      imageSide: z.enum(["left", "right"]).default("left"),
    }),
  }),
  "rich-text": z.object({
    ...base,
    type: z.literal("rich-text"),
    data: z.object({
      /* Композиция: 1 = центриран блок с drop cap, 2 = асиметричен spread
         (заглавие вляво, текст вдясно). */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(100),
      text: shortText(5000),
    }),
  }),
  testimonials: z.object({
    ...base,
    type: z.literal("testimonials"),
    data: z.object({
      /* Композиция: 1 = тъмна инверсия (брандов момент), 2 = светли карти. */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(80),
      items: z
        .array(z.object({ name: shortText(60), text: shortText(400) }))
        .max(10)
        .default([]),
    }),
  }),
  "trust-badges": z.object({
    ...base,
    type: z.literal("trust-badges"),
    data: z.object({
      /* Композиция: 1 = плочки с икона в кръгче, 2 = тиха hairline лента. */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      items: z
        .array(z.object({ icon: z.enum(TRUST_BADGE_ICONS), text: shortText(60) }))
        .max(6)
        .default([]),
    }),
  }),
  gallery: z.object({
    ...base,
    type: z.literal("gallery"),
    data: z.object({
      /* Композиция: 1 = адаптивна мозайка (дует/masonry), 2 = филмова лента
         (хоризонтално плъзгане), 3 = колаж с водеща снимка. */
      variant: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      title: shortText(80),
      imagePaths: z.array(z.string().max(300)).max(12).default([]),
    }),
  }),
  faq: z.object({
    ...base,
    type: z.literal("faq"),
    data: z.object({
      /* Композиция: 1 = центриран акордеон с карти, 2 = spread (заглавие
         вляво, hairline редове вдясно). */
      variant: z.union([z.literal(1), z.literal(2)]).default(1),
      title: shortText(80),
      items: z
        .array(z.object({ question: shortText(200), answer: shortText(1000) }))
        .max(15)
        .default([]),
    }),
  }),
  "contact-map": z.object({
    ...base,
    type: z.literal("contact-map"),
    data: z.object({
      /* Композиция: 1 = редове + карта, 2 = карта-фон с плаващ панел,
         3 = типографска визитка (карта в свиваем блок). */
      variant: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      title: shortText(80),
      showMap: z.boolean().default(true),
    }),
  }),
  socials: z.object({
    ...base,
    type: z.literal("socials"),
    data: z.object({
      /* Композиция: 1 = центрирани пилюли, 2 = плътна CTA лента,
         3 = editorial hairline редове. */
      variant: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
      title: shortText(80),
    }),
  }),
} as const;

export const sectionSchema = z.discriminatedUnion("type", [
  sectionSchemas.hero,
  sectionSchemas.announcement,
  sectionSchemas["featured-products"],
  sectionSchemas["category-grid"],
  sectionSchemas["promo-banner"],
  sectionSchemas["image-text"],
  sectionSchemas["rich-text"],
  sectionSchemas.testimonials,
  sectionSchemas["trust-badges"],
  sectionSchemas.gallery,
  sectionSchemas.faq,
  sectionSchemas["contact-map"],
  sectionSchemas.socials,
]);

export const THEMES = [
  "classic",
  "atelie",
  "vitrina",
  "puls",
  "efir",
  "oniks",
  "signal",
  "osnova",
  "granit",
] as const;

/** Варианти на header-а — композиции (глас идва от темата). 1=inline,
 *  2=центрирано лого, 3=минимал (nav в бургер и на десктоп). */
export const HEADER_VARIANTS = [1, 2, 3] as const;

export const siteSettingsSchema = z.object({
  theme: z.enum(THEMES).default("classic"),
  /* Неутрални тема-агностични дефолти — четими на всичките 9 теми (вкл. тъмните).
     Изборът на цвят става съзнателно в onboarding wizard-а; това е само fallback. */
  primaryColor: hexColor.default("#1f2937"),
  accentColor: hexColor.default("#b45309"),
  /* headerVariant поглъща стария headerLayout: 1=лого вляво (беше logo-left),
     2=центрирано лого (беше logo-center), 3=минимал. Coerce от legacy стрингове
     през preprocess → старите записи без миграция стават валидни. */
  headerVariant: z.preprocess(
    (v) => (v === "logo-left" ? 1 : v === "logo-center" ? 2 : v),
    z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  ),
  /* Footer композиция: 1 = богат тъмен (колони), 2 = минимален центриран. */
  footerVariant: z.union([z.literal(1), z.literal(2)]).default(1),
  /* Header-ът показва само логото (без името) — за лога, които вече съдържат
     името на бранда. Игнорира се, когато магазинът няма качено лого. */
  logoOnly: z.boolean().default(false),
  footerText: shortText(300),
  aboutText: shortText(5000),
  aboutImagePaths: z.array(z.string().max(300)).max(4).default([]),
  sections: z.array(sectionSchema).max(20).default([]),
});

export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionOfType<T extends SectionType> = Extract<Section, { type: T }>;
export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type ThemeId = (typeof THEMES)[number];
