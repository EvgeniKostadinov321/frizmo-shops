import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAuthorizedCron } from "@/lib/cron-auth";

/* Одит #4 SEC-HDR-02: constant-time Bearer гард за cron-овете. */
describe("isAuthorizedCron", () => {
  const orig = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cr3t-value";
  });
  afterEach(() => {
    process.env.CRON_SECRET = orig;
  });

  const withAuth = (v: string) => new Request("https://x/cron", { headers: { authorization: v } });

  it("приема валиден Bearer", () => {
    expect(isAuthorizedCron(withAuth("Bearer s3cr3t-value"))).toBe(true);
  });
  it("отхвърля грешен секрет", () => {
    expect(isAuthorizedCron(withAuth("Bearer wrong"))).toBe(false);
  });
  it("отхвърля липсващ header", () => {
    expect(isAuthorizedCron(new Request("https://x/cron"))).toBe(false);
  });
  it("отхвърля различна дължина (timingSafeEqual не хвърля)", () => {
    expect(isAuthorizedCron(withAuth("Bearer s3cr3t-value-longer"))).toBe(false);
  });
  it("отхвърля когато CRON_SECRET липсва", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedCron(withAuth("Bearer anything"))).toBe(false);
  });
});
