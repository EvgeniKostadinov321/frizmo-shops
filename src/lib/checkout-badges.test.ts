import { describe, expect, it } from "vitest";
import { buildCheckoutBadges } from "./checkout-badges";

describe("buildCheckoutBadges", () => {
  it("винаги включва сигурна поръчка + без регистрация", () => {
    expect(buildCheckoutBadges(0, false).map((b) => b.text)).toEqual([
      "Сигурна поръчка",
      "Без регистрация",
    ]);
  });
  it("COD добавя плащане при доставка отпред", () => {
    expect(buildCheckoutBadges(0, true)[0]).toEqual({
      icon: "truck",
      text: "Плащане при доставка",
    });
  });
  it("връщане > 0 → badge с броя дни", () => {
    expect(buildCheckoutBadges(14, false).some((b) => b.text === "Връщане до 14 дни")).toBe(true);
  });
  it("връщане = 0 → без return badge", () => {
    expect(buildCheckoutBadges(0, false).some((b) => b.icon === "return")).toBe(false);
  });
  it("всичко включено → ред COD, връщане, сигурна, без регистрация", () => {
    expect(buildCheckoutBadges(30, true).map((b) => b.text)).toEqual([
      "Плащане при доставка",
      "Връщане до 30 дни",
      "Сигурна поръчка",
      "Без регистрация",
    ]);
  });
});
