import { describe, expect, it } from "vitest";
import { sanitizeMultiline, sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  it("trim-ва и колабира whitespace", () => expect(sanitizeText("  а   б  ")).toBe("а б"));
  it("маха контролни знаци", () => expect(sanitizeText("а\u0000б\u0007в")).toBe("абв"));
  it("реже до maxLength", () => expect(sanitizeText("абвгд", 3)).toBe("абв"));
});

describe("sanitizeMultiline", () => {
  it("пази новите редове", () => expect(sanitizeMultiline("ред1\nред2")).toBe("ред1\nред2"));
  it("маха контролни знаци, но не новия ред", () =>
    expect(sanitizeMultiline("а\u0000\nб")).toBe("а\nб"));
  it("ограничава последователни празни редове до 2", () =>
    expect(sanitizeMultiline("а\n\n\n\n\nб")).toBe("а\n\nб"));
});
