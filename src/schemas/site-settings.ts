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
      layout: z.enum(["full", "split", "slideshow"]).default("full"),
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
      title: shortText(80),
      mode: z.enum(["manual", "newest", "promo"]).default("newest"),
      productIds: z.array(z.uuid()).max(8).default([]),
    }),
  }),
  "category-grid": z.object({
    ...base,
    type: z.literal("category-grid"),
    data: z.object({
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
      title: shortText(100),
      text: shortText(2000),
      imagePath: z.string().max(300).default(""),
      imageSide: z.enum(["left", "right"]).default("left"),
    }),
  }),
  "rich-text": z.object({
    ...base,
    type: z.literal("rich-text"),
    data: z.object({ title: shortText(100), text: shortText(5000) }),
  }),
  testimonials: z.object({
    ...base,
    type: z.literal("testimonials"),
    data: z.object({
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
      title: shortText(80),
      imagePaths: z.array(z.string().max(300)).max(12).default([]),
    }),
  }),
  faq: z.object({
    ...base,
    type: z.literal("faq"),
    data: z.object({
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
    data: z.object({ title: shortText(80), showMap: z.boolean().default(true) }),
  }),
  socials: z.object({
    ...base,
    type: z.literal("socials"),
    data: z.object({ title: shortText(80) }),
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

export const siteSettingsSchema = z.object({
  theme: z.enum(THEMES).default("classic"),
  primaryColor: hexColor.default("#178150"),
  accentColor: hexColor.default("#c98a1b"),
  headerLayout: z.enum(["logo-left", "logo-center"]).default("logo-left"),
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
