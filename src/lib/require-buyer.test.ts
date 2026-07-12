import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, findFirst, values } = vi.hoisted(() => ({
  getUser: vi.fn(),
  findFirst: vi.fn(),
  values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServer: async () => ({ auth: { getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect: (p: string) => {
    throw new Error(`REDIRECT:${p}`);
  },
  notFound: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: { query: { profiles: { findFirst } }, insert: () => ({ values }) },
  profiles: {},
  shops: {},
}));
vi.mock("@/lib/sanitize", () => ({ sanitizeText: (s: string) => s }));

import { requireBuyer } from "@/lib/auth";

describe("requireBuyer", () => {
  beforeEach(() => {
    getUser.mockReset();
    findFirst.mockReset();
    values.mockClear();
  });

  it("нелогнат → redirect към login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireBuyer()).rejects.toThrow("REDIRECT:/auth/login");
  });

  it("логнат → връща user + profile (гарантира ред)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.bg" } } });
    findFirst.mockResolvedValue({ id: "u1", fullName: "Иван" });
    const res = await requireBuyer();
    expect(res.user.id).toBe("u1");
    expect(res.profile.id).toBe("u1");
  });
});
