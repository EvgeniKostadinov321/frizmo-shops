"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { courierOffices, db, shopCourierAccounts } from "@/db";
import { requireShop } from "@/lib/auth";
import { getCourier, type CourierId } from "@/lib/couriers";
import { searchCachedOffices } from "@/db/queries/couriers";
import { clientIp } from "@/actions/cart";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { courierAccountSchema } from "@/schemas/courier";

export type CourierActionState = { error?: string; ok?: boolean };

export type PublicOffice = { officeId: string; name: string; city: string; address: string };

/**
 * ПУБЛИЧНО (checkout, анонимен купувач): офиси за магазин по куриер+град. Първо от
 * кеша; при празен кеш опреснява от куриера през акаунта на магазина, после чете пак.
 * Офисите са споделена nomenclature (не лични данни) → безопасно за публичен прочит.
 * Скоуп по shopId (магазинът от storefront-а). Грешка → празен списък (graceful).
 */
export async function searchOfficesForShop(
  shopId: string,
  provider: CourierId,
  city: string,
): Promise<PublicOffice[]> {
  const trimmed = city.trim();
  if (trimmed.length < 2) return [];

  const toPublic = (rows: Awaited<ReturnType<typeof searchCachedOffices>>): PublicOffice[] =>
    rows.map((o) => ({ officeId: o.officeId, name: o.name, city: o.city, address: o.address }));

  const cached = await searchCachedOffices(provider, trimmed);
  if (cached.length > 0) return toPublic(cached);

  /* Rate limit ПРЕДИ живата рефреш пътека (одит #3 AUTH-01): това е публичен endpoint;
     без гард атакуващ с публичния shopId зацикля произволни градове → изчерпва куриерската
     API квота на магазина + замърсява споделената офис-номенклатура. Cache hits (горе) не
     минават оттук → остават бързи; троттлва се само скъпият external+upsert път. */
  if (!(await checkRateLimit(`courier-search:${await clientIp()}:${shopId}`, 20, 60))) {
    return [];
  }

  /* Празен кеш → опресни от куриера с акаунта на този магазин, после чети пак. */
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(eq(shopCourierAccounts.shopId, shopId), eq(shopCourierAccounts.provider, provider)),
  });
  if (!account) return [];
  try {
    const courier = getCourier(provider);
    const offices = await courier.searchOffices(
      trimmed,
      account.credentials as Record<string, string>,
    );
    for (const o of offices) {
      await db
        .insert(courierOffices)
        .values({
          provider,
          officeId: o.officeId,
          name: o.name,
          city: o.city,
          address: o.address,
          type: o.type,
        })
        .onConflictDoUpdate({
          target: [courierOffices.provider, courierOffices.officeId],
          set: {
            name: o.name,
            city: o.city,
            address: o.address,
            type: o.type,
            updatedAt: new Date(),
          },
        });
    }
    return offices
      .filter((o) => o.city.toLowerCase().includes(trimmed.toLowerCase()))
      .slice(0, 50)
      .map((o) => ({ officeId: o.officeId, name: o.name, city: o.city, address: o.address }));
  } catch (err) {
    console.error(JSON.stringify({ scope: "courier-public-search", provider, error: String(err) }));
    return [];
  }
}

/** Записва/обновява куриерски акаунт (upsert по shop+provider). Ключовете не се логват. */
export async function saveCourierAccount(
  _prev: CourierActionState,
  formData: FormData,
): Promise<CourierActionState> {
  const { shop } = await requireShop();
  const parsed = courierAccountSchema.safeParse({
    provider: formData.get("provider"),
    username: formData.get("username"),
    password: formData.get("password"),
    senderName: formData.get("senderName"),
    senderPhone: formData.get("senderPhone"),
    senderCity: formData.get("senderCity"),
    senderAddress: formData.get("senderAddress"),
  });
  if (!parsed.success) return { error: "Провери въведените данни." };
  const d = parsed.data;

  const sender = {
    senderName: sanitizeText(d.senderName, 100),
    senderPhone: sanitizeText(d.senderPhone, 30),
    senderCity: sanitizeText(d.senderCity, 60),
    senderAddress: sanitizeText(d.senderAddress, 200),
  };
  const credentials = { username: d.username, password: d.password };

  await db
    .insert(shopCourierAccounts)
    .values({ shopId: shop.id, provider: d.provider, credentials, ...sender })
    .onConflictDoUpdate({
      target: [shopCourierAccounts.shopId, shopCourierAccounts.provider],
      set: { credentials, ...sender, updatedAt: new Date() },
    });

  revalidatePath("/dashboard/fulfillment");
  return { ok: true };
}

/** Трие куриерски акаунт. */
export async function deleteCourierAccount(provider: "econt" | "speedy"): Promise<void> {
  const { shop } = await requireShop();
  await db
    .delete(shopCourierAccounts)
    .where(
      and(
        eq(shopCourierAccounts.shopId, shop.id),
        eq(shopCourierAccounts.provider, provider),
      ),
    );
  revalidatePath("/dashboard/fulfillment");
}

/** Тества ключовете (searchOffices за тестов град) + пълни кеша с офисите. */
export async function testCourierConnection(
  provider: "econt" | "speedy",
): Promise<CourierActionState> {
  const { shop } = await requireShop();
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(
      eq(shopCourierAccounts.shopId, shop.id),
      eq(shopCourierAccounts.provider, provider),
    ),
  });
  if (!account) return { error: "Няма запазен акаунт." };

  try {
    const courier = getCourier(provider);
    const offices = await courier.searchOffices(
      "София",
      account.credentials as Record<string, string>,
    );
    if (offices.length === 0) {
      return { error: "Връзката успя, но не върна офиси. Провери акаунта." };
    }
    return { ok: true };
  } catch (err) {
    console.error(JSON.stringify({ scope: "courier-test", provider, error: String(err) }));
    return { error: "Връзката с куриера не бе успешна. Провери ключовете." };
  }
}

/** Опреснява кеша на офисите за град (lazy — от checkout при празен кеш). */
export async function refreshOffices(
  provider: "econt" | "speedy",
  city: string,
): Promise<void> {
  const { shop } = await requireShop();
  const account = await db.query.shopCourierAccounts.findFirst({
    where: and(
      eq(shopCourierAccounts.shopId, shop.id),
      eq(shopCourierAccounts.provider, provider),
    ),
  });
  if (!account) return;
  try {
    const courier = getCourier(provider);
    const offices = await courier.searchOffices(
      city,
      account.credentials as Record<string, string>,
    );
    for (const o of offices) {
      await db
        .insert(courierOffices)
        .values({
          provider,
          officeId: o.officeId,
          name: o.name,
          city: o.city,
          address: o.address,
          type: o.type,
        })
        .onConflictDoUpdate({
          target: [courierOffices.provider, courierOffices.officeId],
          set: {
            name: o.name,
            city: o.city,
            address: o.address,
            type: o.type,
            updatedAt: new Date(),
          },
        });
    }
  } catch (err) {
    console.error(JSON.stringify({ scope: "courier-refresh", provider, error: String(err) }));
  }
}
