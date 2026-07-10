import { describe, expect, it } from "vitest";
import { dueAbandonedCarts } from "./abandoned-cart";

const now = new Date("2026-07-10T12:00:00Z");

function cart(status: string, minutesAgo: number) {
  return { status, updatedAt: new Date(now.getTime() - minutesAgo * 60 * 1000) };
}

describe("dueAbandonedCarts", () => {
  it("pending по-стар от 1ч → зрял", () => {
    expect(dueAbandonedCarts([cart("pending", 90)], now)).toHaveLength(1);
  });
  it("pending по-млад от 1ч → не", () => {
    expect(dueAbandonedCarts([cart("pending", 30)], now)).toHaveLength(0);
  });
  it("точно на 1ч → зрял (>=)", () => {
    expect(dueAbandonedCarts([cart("pending", 60)], now)).toHaveLength(1);
  });
  it("sent се пропуска", () => {
    expect(dueAbandonedCarts([cart("sent", 120)], now)).toHaveLength(0);
  });
  it("converted се пропуска", () => {
    expect(dueAbandonedCarts([cart("converted", 120)], now)).toHaveLength(0);
  });
  it("смесен списък → само зрелите pending", () => {
    const list = [cart("pending", 90), cart("pending", 10), cart("sent", 200), cart("converted", 300)];
    expect(dueAbandonedCarts(list, now)).toHaveLength(1);
  });
});
