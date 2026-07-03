import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Product, Shop } from "@/db";
import { HeroStorefrontDemo } from "./index";

beforeAll(() => {
  /* jsdom няма matchMedia/IntersectionObserver — Motion ги ползва */
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

const MOCK_PRODUCTS = [
  { id: "1", name: "Краве сирене", priceCents: 1590, promoPriceCents: null, images: [] },
  { id: "2", name: "Планински мед", priceCents: 1250, promoPriceCents: null, images: [] },
  { id: "3", name: "Домашен кашкавал", priceCents: 2300, promoPriceCents: null, images: [] },
] as Pick<Product, "id" | "name" | "priceCents" | "promoPriceCents" | "images">[];

const MOCK_SHOP = { name: "Ферма Зелена долина", city: "Троян" } as Pick<Shop, "name" | "city">;

describe("HeroStorefrontDemo", () => {
  it("renders the shop name in the mini header", () => {
    render(<HeroStorefrontDemo shop={MOCK_SHOP} products={MOCK_PRODUCTS} />);
    expect(screen.getByText("Ферма Зелена долина")).toBeInTheDocument();
  });

  it("renders up to 3 product cards with formatted prices", () => {
    render(<HeroStorefrontDemo shop={MOCK_SHOP} products={MOCK_PRODUCTS} />);
    expect(screen.getByText(/15,90/)).toBeInTheDocument();
    expect(screen.getByText(/12,50/)).toBeInTheDocument();
    expect(screen.getByText(/23,00/)).toBeInTheDocument();
  });

  it("falls back to a demo shop name when shop is null", () => {
    render(<HeroStorefrontDemo shop={null} products={[]} />);
    expect(screen.getByText(/Ферма Зелена долина/)).toBeInTheDocument();
  });
});
