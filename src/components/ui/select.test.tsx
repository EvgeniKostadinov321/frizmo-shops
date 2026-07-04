import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const options = [
  { value: "a", label: "Опция А" },
  { value: "b", label: "Опция Б" },
];

describe("Select", () => {
  it("свързва label с тригера и показва опциите при отваряне", () => {
    render(<Select label="Категория" options={options} value="" onChange={() => {}} />);
    const trigger = screen.getByLabelText("Категория");
    expect(trigger).toBeInTheDocument();
    /* Опциите се рендерират при отваряне (custom dropdown, не native) */
    fireEvent.click(trigger);
    expect(screen.getByRole("option", { name: "Опция А" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Опция Б" })).toBeInTheDocument();
  });

  it("показва placeholder, докато няма избор", () => {
    render(
      <Select label="Категория" options={options} value="" onChange={() => {}} placeholder="Избери..." />,
    );
    expect(screen.getByText("Избери...")).toBeInTheDocument();
  });

  it("подава избраната стойност през onChange като event", () => {
    const onChange = vi.fn();
    render(<Select label="Категория" options={options} value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Категория"));
    fireEvent.click(screen.getByRole("option", { name: "Опция Б" }));
    expect(onChange).toHaveBeenCalledWith({ target: { value: "b" } });
  });

  it("показва грешка с aria-invalid", () => {
    render(
      <Select label="Категория" options={options} value="" onChange={() => {}} error="Избери категория" />,
    );
    expect(screen.getByLabelText("Категория")).toHaveAttribute("data-invalid", "true");
    expect(screen.getByText("Избери категория")).toBeInTheDocument();
  });
});
