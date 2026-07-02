import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./modal";

describe("Modal", () => {
  it("не рендерира нищо при open=false", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Заглавие">
        съдържание
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("рендерира заглавие и съдържание при open", () => {
    render(
      <Modal open onClose={() => {}} title="Заглавие">
        съдържание
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Заглавие")).toBeInTheDocument();
    expect(screen.getByText("съдържание")).toBeInTheDocument();
  });

  it("Escape вика onClose", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Заглавие">
        съдържание
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
