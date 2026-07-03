import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Reveal } from "./reveal";

beforeAll(() => {
  /* jsdom няма matchMedia — Reveal го ползва за prefers-reduced-motion */
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
  /* jsdom няма IntersectionObserver — whileInView го изисква */
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

describe("Reveal", () => {
  it("renders children", () => {
    render(
      <Reveal>
        <p>Съдържание</p>
      </Reveal>,
    );
    expect(screen.getByText("Съдържание")).toBeInTheDocument();
  });

  it("applies a custom className to the wrapper alongside Motion's own attributes", () => {
    render(
      <Reveal className="custom-class">
        <p>Текст</p>
      </Reveal>,
    );
    expect(screen.getByText("Текст").parentElement).toHaveClass("custom-class");
  });
});
