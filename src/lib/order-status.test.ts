import { describe, expect, it } from "vitest";
import { ALLOWED_TRANSITIONS } from "@/lib/order-status";

describe("ALLOWED_TRANSITIONS — pending_payment", () => {
  it("pending_payment → new и cancelled", () => {
    expect(ALLOWED_TRANSITIONS.pending_payment).toEqual(["new", "cancelled"]);
  });
  it("new остава непроменен (не се връща към pending)", () => {
    expect(ALLOWED_TRANSITIONS.new).toEqual(["confirmed", "cancelled"]);
  });
});
