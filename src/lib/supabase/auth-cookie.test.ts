import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./auth-cookie";

describe("hasSupabaseAuthCookie", () => {
  it("празен списък → false", () => {
    expect(hasSupabaseAuthCookie([])).toBe(false);
  });

  it("стандартен auth cookie → true", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-auth-token"])).toBe(true);
  });

  it("chunk-нат auth cookie (.0) → true", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-auth-token.0"])).toBe(true);
  });

  it("несвързани cookies → false", () => {
    expect(hasSupabaseAuthCookie(["frizmo-cookie-notice", "session-id", "theme"])).toBe(false);
  });

  it("смесен списък с auth cookie → true", () => {
    expect(hasSupabaseAuthCookie(["frizmo-theme", "sb-xyz-auth-token", "other"])).toBe(true);
  });

  it("sb- cookie без auth-token (напр. sb-provider) → false", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdef-provider-token"])).toBe(false);
  });
});
