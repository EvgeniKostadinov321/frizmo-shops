import { describe, expect, it } from "vitest";
import { formatIban, isValidBgIban } from "./iban";

describe("isValidBgIban", () => {
  it("валиден BG IBAN", () => {
    expect(isValidBgIban("BG80BNBG96611020345678")).toBe(true);
  });
  it("валиден с интервали и малки букви", () => {
    expect(isValidBgIban("bg80 bnbg 9661 1020 3456 78")).toBe(true);
  });
  it("грешна чексума → невалиден", () => {
    expect(isValidBgIban("BG81BNBG96611020345678")).toBe(false);
  });
  it("грешна дължина → невалиден", () => {
    expect(isValidBgIban("BG80BNBG966110203456")).toBe(false);
  });
  it("друга държава → невалиден (само BG)", () => {
    expect(isValidBgIban("DE89370400440532013000")).toBe(false);
  });
  it("празен → невалиден", () => {
    expect(isValidBgIban("")).toBe(false);
  });
});

describe("formatIban", () => {
  it("групи по 4", () => {
    expect(formatIban("BG80BNBG96611020345678")).toBe("BG80 BNBG 9661 1020 3456 78");
  });
});
