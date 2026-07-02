import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("свързва label с полето", () => {
    render(<Input label="Имейл" name="email" />);
    expect(screen.getByLabelText("Имейл")).toBeInTheDocument();
  });
  it("показва грешка с aria-invalid", () => {
    render(<Input label="Имейл" name="email" error="Невалиден имейл" />);
    expect(screen.getByLabelText("Имейл")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Невалиден имейл")).toBeInTheDocument();
  });
});
