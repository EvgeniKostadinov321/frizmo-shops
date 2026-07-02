import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./select";

const options = [
  { value: "a", label: "Опция А" },
  { value: "b", label: "Опция Б" },
];

describe("Select", () => {
  it("свързва label с полето и рендерира опциите", () => {
    render(<Select label="Категория" options={options} />);
    const select = screen.getByLabelText("Категория");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Опция А" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Опция Б" })).toBeInTheDocument();
  });

  it("показва placeholder като празна опция", () => {
    render(<Select label="Категория" options={options} placeholder="Избери..." />);
    expect(screen.getByRole("option", { name: "Избери..." })).toHaveValue("");
  });

  it("показва грешка с aria-invalid", () => {
    render(<Select label="Категория" options={options} error="Избери категория" />);
    expect(screen.getByLabelText("Категория")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Избери категория")).toBeInTheDocument();
  });
});
