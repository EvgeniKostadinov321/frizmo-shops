import { describe, expect, it, vi } from "vitest";
import { resolveBuyerId } from "@/lib/buyer-id";

describe("resolveBuyerId", () => {
  it("връща user id при логнат", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    };
    expect(await resolveBuyerId(supabase as never)).toBe("u1");
  });
  it("връща null при гост", async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    };
    expect(await resolveBuyerId(supabase as never)).toBeNull();
  });
});
