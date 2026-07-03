import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accordion } from "./accordion";

const ITEMS = [
  { value: "q1", question: "Първи въпрос?", answer: "Първи отговор." },
  { value: "q2", question: "Втори въпрос?", answer: "Втори отговор." },
];

describe("Accordion", () => {
  it("renders all questions, answers collapsed by default", () => {
    render(<Accordion items={ITEMS} />);
    expect(screen.getByText("Първи въпрос?")).toBeInTheDocument();
    expect(screen.getByText("Втори въпрос?")).toBeInTheDocument();
    expect(screen.queryByText("Първи отговор.")).not.toBeInTheDocument();
  });

  it("expands an answer when its question is clicked, has aria-expanded", () => {
    render(<Accordion items={ITEMS} />);
    const trigger = screen.getByRole("button", { name: "Първи въпрос?" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Първи отговор.")).toBeInTheDocument();
  });

  it("collapses the previously open item when a new one is opened (single mode)", () => {
    render(<Accordion items={ITEMS} />);
    fireEvent.click(screen.getByRole("button", { name: "Първи въпрос?" }));
    fireEvent.click(screen.getByRole("button", { name: "Втори въпрос?" }));
    expect(screen.getByRole("button", { name: "Първи въпрос?" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
