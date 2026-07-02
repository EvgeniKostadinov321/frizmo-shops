import { describe, expect, it } from "vitest";
import { sectionSchema, siteSettingsSchema, type SectionType } from "@/schemas/site-settings";
import { defaultSiteSettings, newSection, SECTION_DEFS } from "./sections";

const ALL_TYPES = Object.keys(SECTION_DEFS) as SectionType[];

describe("SECTION_DEFS", () => {
  it("defaultData на всеки тип минава през схемата му", () => {
    for (const type of ALL_TYPES) {
      const section = newSection(type);
      const result = sectionSchema.safeParse(section);
      expect(result.success, `${type}: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it("newSection дава уникални id-та", () => {
    expect(newSection("hero").id).not.toBe(newSection("hero").id);
  });
});

describe("defaultSiteSettings", () => {
  it("е валиден SiteSettings и включва hero с името на магазина", () => {
    const settings = defaultSiteSettings("Ферма Марица");
    const parsed = siteSettingsSchema.safeParse(settings);
    expect(parsed.success).toBe(true);
    const hero = settings.sections[0];
    expect(hero?.type).toBe("hero");
    if (hero?.type === "hero") expect(hero.data.title).toBe("Ферма Марица");
  });
});

describe("siteSettingsSchema tolerance", () => {
  it("отхвърля секция с непознат тип", () => {
    const result = sectionSchema.safeParse({
      id: crypto.randomUUID(),
      type: "nonexistent",
      enabled: true,
      data: {},
    });
    expect(result.success).toBe(false);
  });
});
