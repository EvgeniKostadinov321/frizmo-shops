import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

describe("HeroStorefrontDemo", () => {
  it("renders the showcase shop name in the mini header", () => {
    render(<HeroStorefrontDemo />);
    expect(screen.getByText("Ателие Ръчичка")).toBeInTheDocument();
  });

  it("renders showcase products with formatted prices", () => {
    render(<HeroStorefrontDemo />);
    expect(screen.getByText(/Керамична чаша/)).toBeInTheDocument();
    expect(screen.getByText("34,00 €")).toBeInTheDocument();
    expect(screen.getByText("45,00 €")).toBeInTheDocument();
    expect(screen.getByText("58,00 €")).toBeInTheDocument();
  });

  it("renders the floating order notification and review cards", () => {
    render(<HeroStorefrontDemo />);
    expect(screen.getByText("Нова поръчка")).toBeInTheDocument();
    expect(screen.getByText(/Виктория Д\./)).toBeInTheDocument();
  });
});
