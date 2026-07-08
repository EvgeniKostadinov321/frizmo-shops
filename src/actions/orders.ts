"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql as rawSql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  coupons,
  db,
  orderItems,
  orders,
  paymentMethods,
  products,
  productVariants,
  shippingMethods,
  shops,
} from "@/db";
import { clientIp } from "@/actions/cart";
import { getPricingProducts } from "@/db/queries/cart";
import { normalizeCouponCode } from "@/db/queries/coupons";
import { fail, ok, zodFail, type ActionResult } from "@/lib/action-result";
import { requireShop } from "@/lib/auth";
import { sendOrderEmails, sendOrderStatusEmail, sendReturnRequestEmail } from "@/lib/email";
import { parseBgPhone } from "@/lib/phone";
import { priceCart, type AppliedCoupon, type PricedCart } from "@/lib/pricing";
import { sendNewOrderPush, sendPushToUser } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { variantKey as makeVariantKey } from "@/lib/variants";
import { manualOrderSchema, orderSchema, type OrderInput } from "@/schemas/order";

const LINE_ERROR_MESSAGE = "Някои продукти вече не са налични — виж количката.";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Атомарен декремент на наличности В транзакцията. Всеки update има guard
 * `stock >= qty` (или stock IS NULL = не следи наличност) и RETURNING — ако не
 * върне ред, значи бройката не стига (конкурентна поръчка е взела последната)
 * → хвърляме OUT_OF_STOCK и цялата транзакция се rollback-ва. Това затваря
 * TOCTOU дупката: проверката и декрементът са едно атомарно statement под лока.
 */
async function decrementStock(tx: Tx, lines: OrderInput["lines"]) {
  for (const line of lines) {
    if (line.variantKey) {
      const variants = await tx.query.productVariants.findMany({
        where: eq(productVariants.productId, line.productId),
      });
      const variant = variants.find((v) => makeVariantKey(v.options) === line.variantKey);
      if (variant && variant.stock !== null) {
        const updated = await tx
          .update(productVariants)
          .set({ stock: rawSql`${productVariants.stock} - ${line.qty}` })
          .where(
            and(
              eq(productVariants.id, variant.id),
              rawSql`${productVariants.stock} >= ${line.qty}`,
            ),
          )
          .returning({ id: productVariants.id });
        if (updated.length === 0) throw new Error("OUT_OF_STOCK");
        continue;
      }
    }
    /* Продуктова наличност: NULL = не следи → минава винаги; иначе guard >= qty. */
    const updated = await tx
      .update(products)
      .set({ stock: rawSql`${products.stock} - ${line.qty}` })
      .where(
        and(
          eq(products.id, line.productId),
          rawSql`(${products.stock} is null or ${products.stock} >= ${line.qty})`,
        ),
      )
      .returning({ id: products.id, stock: products.stock });
    if (updated.length === 0) throw new Error("OUT_OF_STOCK");
  }
}

/**
 * Insert на поръчка + редове с пореден номер per-магазин.
 *
 * Поредният номер е `max+1`, което е класически race при два едновременни
 * checkout-а в един магазин. Затваряме го с транзакционен advisory lock върху
 * магазина (`pg_advisory_xact_lock`) ПРЕДИ четенето на max — така вмъкванията за
 * същия магазин се сериализират, а лока се освобождава автоматично при commit/
 * rollback. Няма нужда от retry loop (старият беше и счупен: unique-conflict
 * abort-ва транзакцията и всеки следващ statement хвърля 25P02). Вика се вътре
 * в транзакция.
 */
async function insertOrderWithNumber(
  tx: Tx,
  shopId: string,
  values: Omit<typeof orders.$inferInsert, "shopId" | "orderNumber">,
  lines: PricedCart["lines"],
): Promise<{ orderId: string; publicToken: string; orderNumber: number }> {
  /* Сериализира per-магазин генерирането на номера. hashtextextended → bigint
     ключ, стабилен за същия shopId; освобождава се в края на транзакцията. */
  await tx.execute(rawSql`select pg_advisory_xact_lock(hashtextextended(${shopId}, 0))`);

  const [row] = await tx
    .select({ max: rawSql<number>`coalesce(max(order_number), 0)` })
    .from(orders)
    .where(eq(orders.shopId, shopId));
  const orderNumber = Number(row?.max ?? 0) + 1;

  const [order] = await tx
    .insert(orders)
    .values({ ...values, shopId, orderNumber })
    .returning({ id: orders.id, publicToken: orders.publicToken });

  await tx.insert(orderItems).values(
    lines.map((line) => ({
      orderId: order!.id,
      productId: line.productId,
      productName: line.productName,
      variantLabel: line.variantLabel,
      variantKey: line.variantKey ?? "",
      unitPriceCents: line.unitPriceCents,
      quantity: line.qty,
      lineTotalCents: line.lineTotalCents,
      appliedDeal: line.appliedDeal,
    })),
  );

  return { orderId: order!.id, publicToken: order!.publicToken, orderNumber };
}

export async function createOrder(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ orderId: string; token: string }>> {
  const parsed = orderSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава „успех“ и не научава нищо. */
  if (input.website !== "") return ok({ orderId: randomUUID(), token: randomUUID() });

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop || shop.status !== "published") {
    return fail("Магазинът не приема поръчки в момента.");
  }

  const ip = await clientIp();
  if (!(await checkRateLimit(`order:${ip}:${shop.id}`, 5, 3600))) {
    return fail("Твърде много поръчки за кратко време. Опитай по-късно.");
  }

  const [shipping, payment] = await Promise.all([
    db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, input.shippingMethodId),
        eq(shippingMethods.shopId, shop.id),
        eq(shippingMethods.active, true),
      ),
    }),
    db.query.paymentMethods.findFirst({
      where: and(
        eq(paymentMethods.id, input.paymentMethodId),
        eq(paymentMethods.shopId, shop.id),
        eq(paymentMethods.active, true),
      ),
    }),
  ]);
  if (!shipping) return fail("Избери валиден метод за доставка.");
  if (!payment) return fail("Избери валиден метод за плащане.");

  if (shipping.type !== "pickup" && input.address.trim().length < 5) {
    return { ok: false, error: "Провери полетата с грешки.", fieldErrors: { address: "Въведи адрес за доставка" } };
  }

  const phone = parseBgPhone(input.customerPhone);
  if (!phone.ok) return fail("Невалиден телефонен номер.");

  let created: {
    orderId: string;
    publicToken: string;
    orderNumber: number;
    cart: PricedCart;
    giftWrap: boolean;
    giftCard: boolean;
    giftWrapFeeCents: number;
  };
  try {
    created = await db.transaction(async (tx) => {
      /* Заключваме продуктите — двама за последната бройка е безопасно. */
      const ids = input.lines.map((l) => l.productId);
      await tx.select({ id: products.id }).from(products).where(inArray(products.id, ids)).for("update");

      /* Четем наличността ПРЕЗ tx (под лока) — иначе priceCart проверява остаряла
         снимка отвъд транзакцията. Финалната защита е guard-ът в decrementStock. */
      const pricingProducts = await getPricingProducts(shop.id, ids, tx);

      /* Промо код: препотвърждаваме на сървъра (клиентът може да е манипулирал).
         SELECT ... FOR UPDATE заключва реда → лимитът на употреби е race-safe.
         Невалиден купон между checkout и submit → поръчката пада с ясна грешка,
         вместо тиха промяна на сумата. */
      let appliedCoupon: AppliedCoupon | undefined;
      let couponRowId: string | null = null;
      const code = normalizeCouponCode(input.couponCode);
      if (code) {
        const [row] = await tx
          .select()
          .from(coupons)
          .where(and(eq(coupons.shopId, shop.id), eq(coupons.code, code)))
          .for("update");
        const now = Date.now();
        const invalid =
          !row ||
          !row.active ||
          (row.expiresAt && row.expiresAt.getTime() < now) ||
          (row.maxUses !== null && row.usedCount >= row.maxUses);
        if (invalid) throw new Error("COUPON_INVALID");
        appliedCoupon = {
          code: row!.code,
          discountType: row!.discountType,
          discountValue: row!.discountValue,
          minSubtotalCents: row!.minSubtotalCents,
        };
        couponRowId = row!.id;
      }

      /* N9: опаковка/картичка от НАСТРОЙКАТА на магазина (не от клиента). Таксата
         минава през priceCart → cart.totalCents вече я включва (един източник). */
      const giftWrap = shop.giftWrapEnabled && input.giftWrap;
      const giftCard = shop.giftCardEnabled && input.giftCard;
      const giftWrapFeeCents = giftWrap ? shop.giftWrapFeeCents : 0;

      const cart = priceCart(
        input.lines,
        pricingProducts,
        {
          name: shipping.name,
          priceCents: shipping.priceCents,
          freeOverCents: shipping.freeOverCents,
        },
        appliedCoupon,
        giftWrapFeeCents,
      );
      if (cart.hasErrors || cart.lines.length === 0) {
        throw new Error("CART_ERRORS");
      }
      /* Купонът е валиден, но мин. сумата не е достигната → отказваме поръчката
         (клиентът трябва да махне кода или добави продукти). */
      if (appliedCoupon && cart.couponError === "min_not_met") {
        throw new Error("COUPON_MIN");
      }

      /* Инкрементираме употребите в същата транзакция (атомарно с поръчката). */
      if (couponRowId && cart.discountCents > 0) {
        await tx
          .update(coupons)
          .set({ usedCount: rawSql`${coupons.usedCount} + 1`, updatedAt: new Date() })
          .where(eq(coupons.id, couponRowId));
      }

      await decrementStock(tx, input.lines);

      const inserted = await insertOrderWithNumber(
        tx,
        shop.id,
        {
          customerName: sanitizeText(input.customerName, 100),
          customerPhone: phone.e164,
          customerEmail: sanitizeText(input.customerEmail, 120),
          address: sanitizeText(input.address, 200),
          city: sanitizeText(input.city, 60),
          note: sanitizeText(input.note, 500),
          shippingName: shipping.name,
          shippingPriceCents: cart.shipping?.priceCents ?? 0,
          paymentName: payment.name,
          paymentType: payment.type,
          subtotalCents: cart.subtotalCents,
          couponCode: cart.appliedCouponCode,
          discountCents: cart.discountCents,
          giftWrap,
          giftCard,
          giftNote: giftCard ? sanitizeText(input.giftNote, 200) : "",
          giftWrapFeeCents,
          totalCents: cart.totalCents,
        },
        cart.lines,
      );
      return { ...inserted, cart, giftWrap, giftCard, giftWrapFeeCents };
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "CART_ERRORS" || msg === "OUT_OF_STOCK") return fail(LINE_ERROR_MESSAGE);
    if (msg === "COUPON_INVALID") {
      return fail("Промо кодът вече не е валиден. Премахни го и опитай пак.");
    }
    if (msg === "COUPON_MIN") {
      return fail("Промо кодът не важи за тази сума. Премахни го или добави продукти.");
    }
    console.error("createOrder се провали:", error);
    return fail("Поръчката не можа да бъде създадена. Опитай отново.");
  }

  /* Известията не блокират отговора към купувача. */
  void Promise.allSettled([
    sendOrderEmails(shop, {
      orderNumber: created.orderNumber,
      customerName: sanitizeText(input.customerName, 100),
      customerPhone: phone.e164,
      customerEmail: input.customerEmail,
      address: input.address,
      city: input.city,
      note: input.note,
      shippingName: shipping.name,
      shippingPriceCents: created.cart.shipping?.priceCents ?? 0,
      paymentName: payment.name,
      paymentDetails: payment.details,
      totalCents: created.cart.totalCents,
      lines: created.cart.lines,
      giftWrap: created.giftWrap,
      giftCard: created.giftCard,
      giftNote: created.giftCard ? sanitizeText(input.giftNote, 200) : "",
      giftWrapFeeCents: created.giftWrapFeeCents,
    }),
    sendNewOrderPush(shop, created.orderNumber, created.cart.totalCents),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return ok({ orderId: created.orderId, token: created.publicToken });
}

/**
 * Ръчна поръчка от търговеца („каса"): телефонни/DM/офлайн продажби влизат в
 * системата като нормална поръчка (наличности, пореден номер, snapshot,
 * статистика). През requireShop() — БЕЗ rate-limit/honeypot (не е публичен
 * endpoint), работи и за draft магазин. Статусът започва „confirmed"
 * (търговецът вече я е приел). Без купони — цената на доставка може да е с
 * ръчен override (уговорка по телефона).
 */
export async function createManualOrder(
  rawInput: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = manualOrderSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const { shop } = await requireShop();

  const phone = parseBgPhone(input.customerPhone);
  if (!phone.ok) return fail("Невалиден телефонен номер.");

  const [shipping, payment] = await Promise.all([
    db.query.shippingMethods.findFirst({
      where: and(
        eq(shippingMethods.id, input.shippingMethodId),
        eq(shippingMethods.shopId, shop.id),
        eq(shippingMethods.active, true),
      ),
    }),
    db.query.paymentMethods.findFirst({
      where: and(
        eq(paymentMethods.id, input.paymentMethodId),
        eq(paymentMethods.shopId, shop.id),
        eq(paymentMethods.active, true),
      ),
    }),
  ]);
  if (!shipping) return fail("Избери валиден метод за доставка.");
  if (!payment) return fail("Избери валиден метод за плащане.");

  /* Override → фиксирана цена без праг за безплатна доставка. */
  const shippingOption =
    input.shippingOverrideCents !== null
      ? { name: shipping.name, priceCents: input.shippingOverrideCents, freeOverCents: null }
      : { name: shipping.name, priceCents: shipping.priceCents, freeOverCents: shipping.freeOverCents };

  let created: { orderId: string; publicToken: string; orderNumber: number; cart: PricedCart };
  try {
    created = await db.transaction(async (tx) => {
      const ids = input.lines.map((l) => l.productId);
      await tx.select({ id: products.id }).from(products).where(inArray(products.id, ids)).for("update");

      /* Наличност през tx (под лока) — guard-ът е в decrementStock. */
      const pricingProducts = await getPricingProducts(shop.id, ids, tx);

      /* N9: опаковка/картичка от настройката на магазина; таксата минава през
         priceCart → cart.totalCents вече я включва. */
      const giftWrap = shop.giftWrapEnabled && input.giftWrap;
      const giftCard = shop.giftCardEnabled && input.giftCard;
      const giftWrapFeeCents = giftWrap ? shop.giftWrapFeeCents : 0;

      const cart = priceCart(input.lines, pricingProducts, shippingOption, undefined, giftWrapFeeCents);
      if (cart.hasErrors || cart.lines.length === 0) throw new Error("CART_ERRORS");

      await decrementStock(tx, input.lines);

      const inserted = await insertOrderWithNumber(
        tx,
        shop.id,
        {
          customerName: sanitizeText(input.customerName, 100),
          customerPhone: phone.e164,
          customerEmail: sanitizeText(input.customerEmail, 120),
          address: sanitizeText(input.address, 200),
          city: sanitizeText(input.city, 60),
          note: sanitizeText(input.note, 500),
          shippingName: shipping.name,
          shippingPriceCents: cart.shipping?.priceCents ?? 0,
          paymentName: payment.name,
          paymentType: payment.type,
          subtotalCents: cart.subtotalCents,
          giftWrap,
          giftCard,
          giftNote: giftCard ? sanitizeText(input.giftNote, 200) : "",
          giftWrapFeeCents,
          totalCents: cart.totalCents,
          status: "confirmed",
        },
        cart.lines,
      );
      return { ...inserted, cart };
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "CART_ERRORS" || msg === "OUT_OF_STOCK") {
      return fail("Някои продукти не са налични в исканото количество.");
    }
    console.error("createManualOrder се провали:", error);
    return fail("Поръчката не можа да бъде създадена. Опитай отново.");
  }

  /* Купувачът получава „потвърдена" (ако има имейл); търговецът — нищо (сам я създаде). */
  void Promise.allSettled([
    sendOrderStatusEmail({
      shop,
      order: {
        id: created.orderId,
        orderNumber: created.orderNumber,
        publicToken: created.publicToken,
        customerName: sanitizeText(input.customerName, 100),
        customerEmail: input.customerEmail,
      },
      status: "confirmed",
    }),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return ok({ orderId: created.orderId });
}

/** N12: срокът за връщане (дни) в милисекунди. */
const DAY_MS = 86_400_000;

/**
 * N12: купувачът заявява връщане — от публичната страница на поръчката (token
 * линка). Само от „completed", в срока на магазина (returnWindowDays от
 * последната промяна = завършването). Известява търговеца (имейл + push).
 */
export async function requestReturn(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({
      orderId: z.uuid(),
      token: z.uuid(),
      reason: z.string().trim().max(500).default(""),
    })
    .safeParse(rawInput);
  if (!parsed.success) return fail("Невалидна заявка.");

  const ip = await clientIp();
  if (!(await checkRateLimit(`return:${ip}`, 5, 3600))) {
    return fail("Твърде много заявки. Опитай по-късно.");
  }

  const shop = await db.query.shops.findFirst({ where: eq(shops.slug, shopSlug) });
  if (!shop) return fail("Магазинът не съществува.");

  /* Token-ът е задължителен — само orderId не стига (IDOR защитата на страницата). */
  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.id, parsed.data.orderId),
      eq(orders.shopId, shop.id),
      eq(orders.publicToken, parsed.data.token),
    ),
  });
  if (!order) return fail("Поръчката не съществува.");
  if (order.status !== "completed") {
    return fail("Връщане може да се заяви само за завършена поръчка.");
  }
  if (Date.now() - order.updatedAt.getTime() > shop.returnWindowDays * DAY_MS) {
    return fail(`Срокът за връщане (${shop.returnWindowDays} дни) е изтекъл.`);
  }

  const reason = sanitizeText(parsed.data.reason, 500);
  await db
    .update(orders)
    .set({
      status: "return_requested",
      returnReason: reason,
      returnRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  /* Търговецът научава веднага (неблокиращо). */
  const number = `#${String(order.orderNumber).padStart(4, "0")}`;
  void Promise.allSettled([
    sendReturnRequestEmail({
      shop,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      reason,
    }),
    sendPushToUser(shop.ownerId, {
      title: `Заявено връщане за ${number}`,
      body: reason ? `Причина: ${reason.slice(0, 80)}` : "Виж поръчката в панела.",
      url: `/dashboard/orders/${order.id}`,
    }),
  ]);

  revalidatePath("/dashboard/orders");
  return ok(null);
}

/** Смяна на статус от търговеца; отказ/връщане възстановява наличностите.
 *  N12: completed → return_requested е САМО купувачески преход (requestReturn). */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  return_requested: ["returned", "completed"],
  returned: [],
};

/** Възстановява наличностите по редовете на поръчка (отказ/прието връщане). */
async function restoreStock(tx: Tx, orderId: string) {
  const items = await tx.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) });
  for (const item of items) {
    if (!item.productId) continue;
    if (item.variantKey) {
      const variants = await tx.query.productVariants.findMany({
        where: eq(productVariants.productId, item.productId),
      });
      const variant = variants.find((v) => makeVariantKey(v.options) === item.variantKey);
      if (variant && variant.stock !== null) {
        await tx
          .update(productVariants)
          .set({ stock: variant.stock + item.quantity })
          .where(eq(productVariants.id, variant.id));
        continue;
      }
    }
    await tx
      .update(products)
      .set({
        stock: rawSql`case when stock is null then null else stock + ${item.quantity} end`,
      })
      .where(eq(products.id, item.productId));
  }
}

export async function updateOrderStatus(input: {
  id: string;
  status: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(["confirmed", "shipped", "completed", "cancelled", "returned"]),
    })
    .safeParse(input);
  if (!parsed.success) return fail("Невалидна заявка.");

  const { shop } = await requireShop();
  const order = await db.query.orders.findFirst({ where: eq(orders.id, parsed.data.id) });
  if (!order || order.shopId !== shop.id) return fail("Поръчката не съществува.");

  if (!ALLOWED_TRANSITIONS[order.status]?.includes(parsed.data.status)) {
    return fail("Този преход на статус не е позволен.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    /* Отказ / прието връщане → връщаме наличностите (симетрично на декремента). */
    if (parsed.data.status === "cancelled" || parsed.data.status === "returned") {
      await restoreStock(tx, order.id);
    }
  });

  /* Известяваме купувача при ключовите статуси (ако е дал имейл). Неблокиращо —
     имейлът не бива да бави отговора към търговеца, нито да чупи смяната.
     N12: return_requested → completed = отказано връщане (специален имейл). */
  const newStatus = parsed.data.status;
  const emailStatus =
    newStatus === "completed"
      ? order.status === "return_requested"
        ? ("return_rejected" as const)
        : null
      : newStatus;
  if (emailStatus) {
    void Promise.allSettled([
      sendOrderStatusEmail({
        shop,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          publicToken: order.publicToken,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
        },
        status: emailStatus,
      }),
    ]);
  }

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return ok(null);
}
