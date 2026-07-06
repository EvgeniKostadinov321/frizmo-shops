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
import { sendOrderEmails } from "@/lib/email";
import { parseBgPhone } from "@/lib/phone";
import { priceCart, type AppliedCoupon, type PricedCart } from "@/lib/pricing";
import { sendNewOrderPush } from "@/lib/push";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { variantKey as makeVariantKey } from "@/lib/variants";
import { orderSchema, type OrderInput } from "@/schemas/order";

const LINE_ERROR_MESSAGE = "Някои продукти вече не са налични — виж количката.";

/** Декремент на наличности вътре в транзакция (редовете вече са заключени). */
async function decrementStock(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: OrderInput,
) {
  for (const line of input.lines) {
    if (line.variantKey) {
      const variants = await tx.query.productVariants.findMany({
        where: eq(productVariants.productId, line.productId),
      });
      const variant = variants.find((v) => makeVariantKey(v.options) === line.variantKey);
      if (variant && variant.stock !== null) {
        await tx
          .update(productVariants)
          .set({ stock: variant.stock - line.qty })
          .where(eq(productVariants.id, variant.id));
        continue;
      }
    }
    await tx
      .update(products)
      .set({ stock: rawSql`case when stock is null then null else stock - ${line.qty} end` })
      .where(eq(products.id, line.productId));
  }
}

export async function createOrder(
  shopSlug: string,
  rawInput: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const parsed = orderSchema.safeParse(rawInput);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  /* Honeypot: ботът получава "успех" и не научава нищо. */
  if (input.website !== "") return ok({ orderId: randomUUID() });

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

  let created: { orderId: string; orderNumber: number; cart: PricedCart };
  try {
    created = await db.transaction(async (tx) => {
      /* Заключваме продуктите — двама за последната бройка е безопасно. */
      const ids = input.lines.map((l) => l.productId);
      await tx.select({ id: products.id }).from(products).where(inArray(products.id, ids)).for("update");

      const pricingProducts = await getPricingProducts(shop.id, ids);

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

      const cart = priceCart(
        input.lines,
        pricingProducts,
        {
          name: shipping.name,
          priceCents: shipping.priceCents,
          freeOverCents: shipping.freeOverCents,
        },
        appliedCoupon,
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

      await decrementStock(tx, input);

      /* Пореден номер per-магазин: max+1 с 3 retry-а при конкурентен conflict. */
      for (let attempt = 0; ; attempt++) {
        const [row] = await tx
          .select({ max: rawSql<number>`coalesce(max(order_number), 0)` })
          .from(orders)
          .where(eq(orders.shopId, shop.id));
        const orderNumber = Number(row?.max ?? 0) + 1;
        try {
          const [order] = await tx
            .insert(orders)
            .values({
              shopId: shop.id,
              orderNumber,
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
              totalCents: cart.totalCents,
            })
            .returning({ id: orders.id });

          await tx.insert(orderItems).values(
            cart.lines.map((line) => ({
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

          return { orderId: order!.id, orderNumber, cart };
        } catch (e) {
          if (attempt >= 2) throw e;
        }
      }
    });
  } catch (error) {
    const msg = (error as Error).message;
    if (msg === "CART_ERRORS") return fail(LINE_ERROR_MESSAGE);
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
    }),
    sendNewOrderPush(shop, created.orderNumber, created.cart.totalCents),
  ]);

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return ok({ orderId: created.orderId });
}

/** Смяна на статус от търговеца; отказ връща наличностите. */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(input: {
  id: string;
  status: string;
}): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(["confirmed", "shipped", "completed", "cancelled"]),
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

    /* Отказ → връщаме наличностите (симетрично на декремента). */
    if (parsed.data.status === "cancelled") {
      const items = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, order.id),
      });
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
  });

  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
  return ok(null);
}
