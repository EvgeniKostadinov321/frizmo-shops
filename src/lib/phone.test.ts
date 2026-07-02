import { describe, expect, it } from "vitest";
import { parseBgPhone } from "./phone";

describe("parseBgPhone", () => {
  it("приема локален формат и връща E.164", () => {
    expect(parseBgPhone("0888123456")).toEqual({ ok: true, e164: "+359888123456" });
  });
  it("приема формат с интервали и скоби", () => {
    expect(parseBgPhone("+359 (888) 12-34-56")).toEqual({ ok: true, e164: "+359888123456" });
  });
  it("приема 00359 префикс", () => {
    expect(parseBgPhone("00359888123456")).toEqual({ ok: true, e164: "+359888123456" });
  });
  it("приема стационарен номер (02...)", () => {
    expect(parseBgPhone("029876543")).toEqual({ ok: true, e164: "+35929876543" });
  });
  it("отхвърля стационарен при requireMobile", () => {
    expect(parseBgPhone("029876543", { requireMobile: true }).ok).toBe(false);
  });
  it("отхвърля букви", () => {
    expect(parseBgPhone("0888abc456").ok).toBe(false);
  });
  it("отхвърля твърде къс номер", () => {
    expect(parseBgPhone("0888123").ok).toBe(false);
  });
  it("отхвърля твърде дълъг номер", () => {
    expect(parseBgPhone("08881234567890").ok).toBe(false);
  });
  it("отхвърля чужди номера по подразбиране", () => {
    expect(parseBgPhone("+447911123456").ok).toBe(false);
  });
  it("празен вход дава empty", () => {
    expect(parseBgPhone("")).toEqual({ ok: false, reason: "empty" });
  });
});
