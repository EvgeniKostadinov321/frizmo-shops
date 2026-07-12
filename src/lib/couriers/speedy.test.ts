import { afterEach, describe, expect, it, vi } from "vitest";
import { speedy } from "./speedy";
import { CourierError } from "./types";

const creds = { username: "u", password: "p" };

afterEach(() => vi.restoreAllMocks());

/* Speedy REST API (api.speedy.bg/v1). Полетата се сверяват на живо при пристигане на
   ключовете (заявка до api.registration@speedy.bg). Mock-ът тества НАШАТА логика
   (парсване/mapping/грешки), не реалния контракт. */
describe("speedy.searchOffices", () => {
  it("парсва офисите към Office[]", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          offices: [
            {
              id: 55,
              name: "Офис Център",
              address: { siteName: "София", fullAddressString: "бул. Y 2" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const offices = await speedy.searchOffices("София", creds);
    expect(offices).toEqual([
      { officeId: "55", name: "Офис Център", city: "София", address: "бул. Y 2", type: "office" },
    ]);
  });

  it("не-2xx → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 403 }));
    await expect(speedy.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });
});

describe("speedy.trackingUrl", () => {
  it("връща tracking URL с номера", () => {
    expect(speedy.trackingUrl("XYZ789")).toContain("XYZ789");
  });
});
