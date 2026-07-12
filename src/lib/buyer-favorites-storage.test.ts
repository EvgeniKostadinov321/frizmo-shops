import { describe, expect, it } from "vitest";
import { pickFavoriteMode } from "@/lib/buyer-favorites-storage";

describe("pickFavoriteMode", () => {
  it("логнат → server", () => expect(pickFavoriteMode(true)).toBe("server"));
  it("гост → local", () => expect(pickFavoriteMode(false)).toBe("local"));
});
