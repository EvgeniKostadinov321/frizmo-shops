import { afterEach, describe, expect, it, vi } from "vitest";
import { speedy } from "./speedy";
import { CourierError } from "./types";
import type { WaybillInput } from "./types";

const creds = { username: "u", password: "p" };

afterEach(() => vi.restoreAllMocks());

/* Speedy REST API (api.speedy.bg/v1). Контрактът е СВЕРЕН НА ЖИВО срещу тест акаунт
   (office/site/services, 2026-07-25). Mock-ът тества НАШАТА логика (mapping/грешки/
   двете заявки на товарителницата), не реалния контракт. */
describe("speedy.searchOffices", () => {
  it("парсва офисите към Office[] (вкл. APS→apt)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          offices: [
            {
              id: 55,
              name: "Офис Център",
              type: "OFFICE",
              address: { siteName: "София", fullAddressString: "бул. Y 2" },
            },
            {
              id: 77,
              name: "Автомат Мол",
              type: "APS",
              address: { siteName: "Пловдив", fullAddressString: "ул. Х 1" },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const offices = await speedy.searchOffices("София", creds);
    expect(offices).toEqual([
      { officeId: "55", name: "Офис Център", city: "София", address: "бул. Y 2", type: "office" },
      { officeId: "77", name: "Автомат Мол", city: "Пловдив", address: "ул. Х 1", type: "apt" },
    ]);
  });

  it("не-2xx → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 403 }));
    await expect(speedy.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });

  it("HTTP 200 с тяло { error } → CourierError (Speedy бизнес грешка)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 100, message: "Invalid login" } }), {
        status: 200,
      }),
    );
    await expect(speedy.searchOffices("София", creds)).rejects.toBeInstanceOf(CourierError);
  });
});

const waybillInput: WaybillInput = {
  receiverName: "Иван Петров",
  receiverPhone: "0888123456",
  officeId: "55",
  address: "",
  city: "София",
  sender: { name: "Магазин", phone: "0877000000", city: "София", address: "ул. А 1" },
  weightGrams: 800,
  codCents: 4500,
  contents: "Дреха",
};

describe("speedy.createWaybill", () => {
  it("създава пратка + взима PDF (суров binary) с ОТДЕЛНА /print заявка → base64", async () => {
    /* /print връща суров PDF binary (сверено на живо) — mock-ваме байтове + content-type. */
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const fetchMock = vi
      .spyOn(global, "fetch")
      /* 1-ва заявка: /shipment → връща id */
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "9999" }), { status: 200 }))
      /* 2-ра заявка: /print → суров PDF */
      .mockResolvedValueOnce(
        new Response(pdfBytes, { status: 200, headers: { "content-type": "application/pdf" } }),
      );

    const result = await speedy.createWaybill(waybillInput, creds);
    expect(result.waybillId).toBe("9999");
    expect(result.trackingNumber).toBe("9999");
    /* PDF-ът е кодиран base64 ("%PDF-" → "JVBERi0="). */
    expect(result.labelPdf).toBe(Buffer.from(pdfBytes).toString("base64"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/print");
  });

  it("ако /print гръмне → връща празен етикет, но пази номера (не хвърля)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "1234" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("print fail", { status: 500 }));

    const result = await speedy.createWaybill(waybillInput, creds);
    expect(result.waybillId).toBe("1234");
    expect(result.labelPdf).toBe("");
  });

  it("ако /print върне не-PDF (JSON грешка) → празен етикет, номерът остава", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "1234" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "no label" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const result = await speedy.createWaybill(waybillInput, creds);
    expect(result.waybillId).toBe("1234");
    expect(result.labelPdf).toBe("");
  });

  it("липсващ id в отговора → CourierError", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    await expect(speedy.createWaybill(waybillInput, creds)).rejects.toBeInstanceOf(CourierError);
  });
});

describe("speedy.calculatePrice", () => {
  it("парсва calculations[0].price.total (EUR) към центове", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ calculations: [{ serviceId: 505, price: { total: 3.44, currency: "EUR" } }] }),
        { status: 200 },
      ),
    );
    const res = await speedy.calculatePrice(
      { officeId: "2", city: "София", weightGrams: 800, codCents: null },
      creds,
    );
    expect(res).toEqual({ amountCents: 344 });
  });

  it("бизнес грешка (200 с { error }) → null (fallback към резервна)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "x" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await speedy.calculatePrice(
      { officeId: "2", city: "София", weightGrams: 800, codCents: null },
      creds,
    );
    expect(res).toBeNull();
  });

  it("HTTP грешка → null (не хвърля)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("fail", { status: 500 }));
    const res = await speedy.calculatePrice(
      { officeId: "2", city: "София", weightGrams: 800, codCents: null },
      creds,
    );
    expect(res).toBeNull();
  });
});

describe("speedy.trackingUrl", () => {
  it("връща tracking URL с номера", () => {
    expect(speedy.trackingUrl("XYZ789")).toContain("XYZ789");
  });
});
