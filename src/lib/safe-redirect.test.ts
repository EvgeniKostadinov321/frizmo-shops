import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("null/undefined/празно → /dashboard", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath(undefined)).toBe("/dashboard");
    expect(safeNextPath("")).toBe("/dashboard");
  });

  it("валиден относителен път → връща го", () => {
    expect(safeNextPath("/dashboard/orders")).toBe("/dashboard/orders");
    expect(safeNextPath("/s/moya-magazin")).toBe("/s/moya-magazin");
  });

  it("protocol-relative // → /dashboard (open-redirect)", () => {
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
  });

  it("абсолютен URL → /dashboard", () => {
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("http://evil.com")).toBe("/dashboard");
  });

  it("път със схема/двоеточие → /dashboard", () => {
    expect(safeNextPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("път без водещ / → /dashboard", () => {
    expect(safeNextPath("dashboard")).toBe("/dashboard");
  });
});
