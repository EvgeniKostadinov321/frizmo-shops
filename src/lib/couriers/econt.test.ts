import { afterEach, describe, expect, it, vi } from "vitest";
import { econt } from "./econt";
import { CourierError } from "./types";

const creds = { username: "u", password: "p" };

afterEach(() => vi.restoreAllMocks());

/* Структурата на отговорите огледва РЕАЛНИЯ Econt demo API (сверено на живо 2026-07-13):
   офис = { code, name, isAPS, address: { city: { name }, fullAddress } }. */
describe("econt.searchOffices", () => {
  it("парсва офисите към Office[] (филтрира по address.city.name)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          offices: [
            {
              code: "1234",
              name: "Офис Люлин",
              isAPS: false,
              address: { city: { name: "София" }, fullAddress: "ул. Х 1" },
            },
            {
              code: "5678",
              name: "Офис Пловдив",
              isAPS: false,
              address: { city: { name: "Пловдив" }, fullAddress: "ул. Y 2" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const offices = await econt.searchOffices("София", creds);
    expect(offices).toEqual([
      { officeId: "1234", name: "Офис Люлин", city: "София", address: "ул. Х 1", type: "office" },
    ]);
  });

  it("isAPS → type apt (автомат)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          offices: [
            {
              code: "1702",
              name: "Еконтомат Русе",
              isAPS: true,
              address: { city: { name: "Русе" }, fullAddress: "бул. Z 3" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const offices = await econt.searchOffices("Русе", creds);
    expect(offices[0].type).toBe("apt");
  });

  it("не-2xx → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 401 }));
    await expect(econt.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });
});

describe("econt.trackingUrl", () => {
  it("връща tracking URL с номера", () => {
    expect(econt.trackingUrl("ABC123")).toContain("ABC123");
  });
});
