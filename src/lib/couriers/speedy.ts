import type { CourierCreds, CourierProvider, Office } from "./types";
import { CourierError } from "./types";

/* Speedy REST API (v1). Auth: userName/password + language в тялото на всяка заявка.
   Контрактът е СВЕРЕН НА ЖИВО срещу тест акаунт (2026-07-25): office/site/services.
   Base от SPEEDY_API_BASE (тест/prod override), иначе production v1.
   Тест ключове (фиктивен обект): user 1996581. За PRODUCTION → подписан договор +
   реален клиентски номер (client ID) от Спиди. */
const SPEEDY_BASE = process.env.SPEEDY_API_BASE ?? "https://api.speedy.bg/v1";

/** Speedy връща 200 с тяло `{ error: { code, message } }` при бизнес грешка —
 *  затова проверяваме и HTTP статуса, и наличието на `error` в JSON-а. */
async function speedyPost<T>(path: string, creds: CourierCreds, body: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SPEEDY_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: creds.username,
        password: creds.password,
        language: "BG",
        ...body,
      }),
    });
  } catch (err) {
    throw new CourierError("Куриерската услуга не отговори.", err);
  }
  if (!res.ok) {
    throw new CourierError("Куриерската услуга не отговори.", { status: res.status });
  }
  const json = (await res.json()) as T & { error?: { code?: number; message?: string } };
  if (json?.error) {
    /* Детайлът отива в лог; навън — общо BG съобщение. */
    throw new CourierError("Заявката към куриера не бе приета.", json.error);
  }
  return json;
}

export const speedy: CourierProvider = {
  id: "speedy",

  async searchOffices(city, creds) {
    /* POST /location/office — офиси по частично име на населено място (сверено на живо:
       връща `offices[]`; всеки офис има address.siteName/fullAddressString + type). */
    const data = await speedyPost<{ offices?: SpeedyOffice[] }>("/location/office", creds, {
      countryId: 100, // BG (сверено на живо)
      name: city.trim(),
    });
    return (data.offices ?? []).map(
      (o): Office => ({
        officeId: String(o.id),
        name: o.name,
        city: o.address?.siteName ?? "",
        address: o.address?.fullAddressString ?? "",
        /* APS = автомат за пратки (Speedy „БоксНау"/APT); всичко друго = гише. */
        type: o.type === "APS" ? "apt" : "office",
      }),
    );
  },

  async createWaybill(input, creds) {
    /* POST /shipment — товарителница (контракт сверен с docs/живо API).
       Отговорът дава `id`; PDF етикетът НЕ идва тук — взима се с отделна /print заявка. */
    const shipment = await speedyPost<SpeedyShipmentResult>("/shipment", creds, {
      sender: {
        contactName: input.sender.name,
        phone1: { number: input.sender.phone },
      },
      recipient: {
        clientName: input.receiverName,
        phone1: { number: input.receiverPhone },
        privatePerson: true,
        /* Офис доставка → pickupOfficeId; адресна → address с населено място + улица. */
        pickupOfficeId: input.officeId ? Number(input.officeId) : undefined,
        address: input.officeId
          ? undefined
          : { siteName: input.city, addressLine1: input.address },
      },
      service: {
        serviceId: SPEEDY_STANDARD_SERVICE,
        autoAdjustPickupDate: true,
        additionalServices:
          input.codCents != null
            ? { cod: { amount: input.codCents / 100, processingType: "CASH" } }
            : undefined,
      },
      content: {
        parcelsCount: 1,
        totalWeight: input.weightGrams / 1000, // kg
        contents: input.contents,
        package: "КУТИЯ",
      },
      /* При наложен платеж получателят обикновено плаща куриерската услуга. */
      payment: {
        courierServicePayer: input.codCents != null ? "RECIPIENT" : "SENDER",
      },
    });

    const parcelId = String(shipment.id ?? "");
    if (!parcelId) throw new CourierError("Куриерът не върна номер на пратка.", shipment);

    /* PDF етикет — отделна /print заявка (връща base64 в `data` или URL). */
    const labelPdf = await fetchLabel(parcelId, creds);
    return { waybillId: parcelId, trackingNumber: parcelId, labelPdf };
  },

  async calculatePrice(input, creds) {
    /* POST /calculate — сверено на живо (2026-07-24): `calculations[0].price.total`
       в EUR (България е в еврозоната от 01.2026 → без конверсия). null при всяка
       грешка → викащият пада на резервната цена (не блокира checkout). */
    try {
      const data = await speedyPost<{
        calculations?: { price?: { total?: number } }[];
      }>("/calculate", creds, {
        recipient: {
          privatePerson: true,
          pickupOfficeId: input.officeId ? Number(input.officeId) : undefined,
          address: input.officeId ? undefined : { siteName: input.city },
        },
        service: {
          autoAdjustPickupDate: true,
          serviceIds: [SPEEDY_STANDARD_SERVICE],
          additionalServices:
            input.codCents != null
              ? { cod: { amount: input.codCents / 100, processingType: "CASH" } }
              : undefined,
        },
        content: { parcelsCount: 1, totalWeight: input.weightGrams / 1000 },
        payment: { courierServicePayer: input.codCents != null ? "RECIPIENT" : "SENDER" },
      });
      const total = data.calculations?.[0]?.price?.total;
      if (typeof total !== "number") return null;
      return { amountCents: Math.round(total * 100) };
    } catch {
      return null;
    }
  },

  trackingUrl(trackingNumber) {
    return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${trackingNumber}`;
  },
};

/** Стандартна услуга „24 часа" (сверено на живо: 505 = СТАНДАРТ). */
const SPEEDY_STANDARD_SERVICE = 505;

/**
 * POST /print — PDF етикет за вече създадена пратка. ⚠️ Сверено на живо: /print връща
 * СУРОВ PDF binary (`Content-Type: application/pdf`, `%PDF-…`), НЕ JSON — затова НЕ
 * минава през speedyPost (който прави res.json()). Четем байтовете и ги кодираме base64
 * (`WaybillResult.labelPdf` = base64 или URL). Ако /print гръмне, товарителницата ВЕЧЕ е
 * създадена — не хвърляме (номерът е ценен); връщаме празен етикет и логваме.
 */
async function fetchLabel(parcelId: string, creds: CourierCreds): Promise<string> {
  try {
    const res = await fetch(`${SPEEDY_BASE}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: creds.username,
        password: creds.password,
        language: "BG",
        paperSize: "A6",
        parcels: [{ parcel: { id: parcelId } }],
      }),
    });
    if (!res.ok) throw new Error(`print HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "";
    /* Успех → application/pdf binary. Грешка → JSON с { error }. */
    if (contentType.includes("application/pdf")) {
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.toString("base64");
    }
    /* Не-PDF отговор = бизнес грешка от Speedy → логваме, връщаме празно. */
    console.error(JSON.stringify({ evt: "speedy_print_not_pdf", parcelId, body: await res.text() }));
    return "";
  } catch (err) {
    console.error(JSON.stringify({ evt: "speedy_print_failed", parcelId }), err);
    return "";
  }
}

interface SpeedyOffice {
  id: number;
  name: string;
  type?: string; // "OFFICE" | "APS"
  address?: { siteName?: string; fullAddressString?: string };
}
interface SpeedyShipmentResult {
  id?: string | number;
}
