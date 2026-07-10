import { describe, expect, it } from "vitest";
import { parseOrderNumber } from "./order-number";

describe("parseOrderNumber", () => {
  it("маха # и водещи нули", () => expect(parseOrderNumber("#0042")).toBe(42));
  it("приема голо число", () => expect(parseOrderNumber("42")).toBe(42));
  it("трим-ва интервали", () => expect(parseOrderNumber(" 42 ")).toBe(42));
  it("приема # без нули", () => expect(parseOrderNumber("#42")).toBe(42));
  it("отхвърля текст", () => expect(parseOrderNumber("abc")).toBeNull());
  it("отхвърля нула", () => expect(parseOrderNumber("0")).toBeNull());
  it("отхвърля отрицателни", () => expect(parseOrderNumber("-5")).toBeNull());
  it("отхвърля празно", () => expect(parseOrderNumber("")).toBeNull());
  it("отхвърля смесено", () => expect(parseOrderNumber("4a")).toBeNull());
});
