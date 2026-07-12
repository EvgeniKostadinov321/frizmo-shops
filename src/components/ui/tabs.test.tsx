import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Tabs, TabPanel } from "./tabs";

function setup() {
  return render(
    <Tabs
      ariaLabel="Тест"
      tabs={[
        { key: "a", label: "Първи" },
        { key: "b", label: "Втори", marker: true },
      ]}
    >
      <TabPanel tabKey="a">Съдържание A</TabPanel>
      <TabPanel tabKey="b">Съдържание B</TabPanel>
    </Tabs>,
  );
}

describe("Tabs", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("показва първия таб по подразбиране при липсващ ?tab", () => {
    setup();
    expect(screen.getByRole("tab", { name: "Първи" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "false");
  });

  it("уважава валиден ?tab от URL", () => {
    window.history.replaceState(null, "", "/?tab=b");
    setup();
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
  });

  it("пада на първия таб при невалиден ?tab", () => {
    window.history.replaceState(null, "", "/?tab=zzz");
    setup();
    expect(screen.getByRole("tab", { name: "Първи" })).toHaveAttribute("aria-selected", "true");
  });

  it("клик сменя активния таб и обновява URL плитко", () => {
    setup();
    fireEvent.click(screen.getByRole("tab", { name: /Втори/ }));
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("b");
  });

  it("стрелка надясно мести активния таб", () => {
    setup();
    const first = screen.getByRole("tab", { name: "Първи" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("aria-selected", "true");
  });

  it("рендерира всички панели (неактивните са hidden)", () => {
    setup();
    const panelB = screen.getByText("Съдържание B").closest("[role=tabpanel]");
    expect(panelB).toHaveAttribute("hidden");
    const panelA = screen.getByText("Съдържание A").closest("[role=tabpanel]");
    expect(panelA).not.toHaveAttribute("hidden");
  });

  it("показва marker на таб с marker:true", () => {
    setup();
    expect(screen.getByRole("tab", { name: /Втори/ })).toHaveAttribute("data-marker", "true");
  });
});
