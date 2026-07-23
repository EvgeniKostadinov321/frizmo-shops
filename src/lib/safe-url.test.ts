import { describe, expect, it } from "vitest";
import { isSafeHref, safeHref } from "@/lib/safe-url";

describe("isSafeHref (одит #2 VAL-01 — XSS защита)", () => {
  it("отхвърля опасни протоколи", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JavaScript:alert(1)")).toBe(false);
    expect(isSafeHref("  javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafeHref("vbscript:msgbox(1)")).toBe(false);
    expect(isSafeHref("file:///etc/passwd")).toBe(false);
    expect(isSafeHref("//evil.com")).toBe(false); // scheme-relative → външен хост
  });

  it("приема безопасни цели", () => {
    expect(isSafeHref("https://facebook.com/shop")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("/products")).toBe(true);
    expect(isSafeHref("/s/shop/about")).toBe(true);
    expect(isSafeHref("mailto:shop@example.com")).toBe(true);
    expect(isSafeHref("tel:+359888123456")).toBe(true);
    expect(isSafeHref("")).toBe(true); // празно = няма линк
  });
});

describe("safeHref (render неутрализация)", () => {
  it("връща празно за опасни, стойността за безопасни", () => {
    expect(safeHref("javascript:alert(1)")).toBe("");
    expect(safeHref("https://ok.com")).toBe("https://ok.com");
    expect(safeHref(null)).toBe("");
    expect(safeHref(undefined)).toBe("");
    expect(safeHref("  https://ok.com  ")).toBe("https://ok.com");
  });
});
