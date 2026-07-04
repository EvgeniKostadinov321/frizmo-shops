import { describe, expect, it } from "vitest";
import { siteSettingsSchema, THEMES } from "./site-settings";

describe("THEMES", () => {
  it("съдържа 9 теми вкл. тъмните", () => {
    expect(THEMES).toEqual([
      "classic",
      "atelie",
      "vitrina",
      "puls",
      "efir",
      "oniks",
      "signal",
      "osnova",
      "granit",
    ]);
  });

  it("parse-ва валидна нова тема", () => {
    const r = siteSettingsSchema.safeParse({
      theme: "oniks",
      primaryColor: "#c9a25a",
      accentColor: "#c9a25a",
    });
    expect(r.success).toBe(true);
  });

  it("невалидна тема → грешка (толерантният parse в queries я хваща отделно)", () => {
    const r = siteSettingsSchema.safeParse({ theme: "не-съществува" });
    expect(r.success).toBe(false);
  });
});
