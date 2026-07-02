import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("рендерира текста", () => {
    render(<Button>Запази</Button>);
    expect(screen.getByRole("button", { name: "Запази" })).toBeInTheDocument();
  });
  it("loading блокира бутона и показва spinner", () => {
    render(<Button loading>Запази</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.querySelector("[data-slot=spinner]")).not.toBeNull();
  });
  it("подава native props", () => {
    render(<Button type="submit">Изпрати</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
