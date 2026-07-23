import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "@/lib/order-status";

describe("ALLOWED_TRANSITIONS — pending_payment", () => {
  it("pending_payment → new и cancelled", () => {
    expect(ALLOWED_TRANSITIONS.pending_payment).toEqual(["new", "cancelled"]);
  });
  it("new остава непроменен (не се връща към pending)", () => {
    expect(ALLOWED_TRANSITIONS.new).toEqual(["confirmed", "cancelled"]);
  });
  /* Одит #3 BL-02: completed → return_requested е легитимен (заявка за връщане),
     затова таблицата вече го съдържа (беше празен масив → requestReturn го заобикаляше). */
  it("completed → return_requested е позволен (таблицата е авторитетна)", () => {
    expect(ALLOWED_TRANSITIONS.completed).toContain("return_requested");
  });
});
