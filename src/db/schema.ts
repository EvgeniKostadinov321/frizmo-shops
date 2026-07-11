import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const shopStatusEnum = pgEnum("shop_status", [
  "draft",
  "published",
  "suspended",
  "blocked",
]);

/** Тип отстъпка за купон/welcome/referral (дефиниран рано — ползва се в shops). */
export const couponTypeEnum = pgEnum("coupon_type", ["percent", "fixed"]);

/**
 * 1:1 със Supabase auth.users (id = auth user id).
 * enableRLS без политики: достъпът е само през сървъра (Drizzle, direct Postgres) —
 * Data API-то с anon key не може да чете таблиците.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const shops = pgTable(
  "shops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => profiles.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    businessCategory: text("business_category").notNull(),
    logoPath: text("logo_path"),
    city: text("city"),
    address: text("address"),
    phone: text("phone"),
    email: text("email"),
    workingHours: jsonb("working_hours"),
    socialLinks: jsonb("social_links"),
    /** N9: подаръчна опаковка (настройка на търговеца, такса snapshot-ва се в поръчката). */
    giftWrapEnabled: boolean("gift_wrap_enabled").notNull().default(false),
    giftWrapFeeCents: integer("gift_wrap_fee_cents").notNull().default(0),
    /** N9: подаръчна картичка (текст поздрав) — независим от опаковката toggle. */
    giftCardEnabled: boolean("gift_card_enabled").notNull().default(false),
    /** N12: срок за заявка на връщане в дни (14/30/45, валидира се в Zod). */
    returnWindowDays: integer("return_window_days").notNull().default(14),
    /** В1: Welcome купон за нови абонати (авто при потвърждение). Използва couponTypeEnum. */
    welcomeCouponEnabled: boolean("welcome_coupon_enabled").notNull().default(false),
    welcomeCouponType: couponTypeEnum("welcome_coupon_type").notNull().default("percent"),
    welcomeCouponValue: integer("welcome_coupon_value").notNull().default(10),
    welcomeCouponMinSubtotalCents: integer("welcome_coupon_min_subtotal_cents")
      .notNull()
      .default(0),
    /** В2: Реферален купон (за приятел на абоната). */
    referralEnabled: boolean("referral_enabled").notNull().default(false),
    referralType: couponTypeEnum("referral_type").notNull().default("percent"),
    referralValue: integer("referral_value").notNull().default(10),
    referralMinSubtotalCents: integer("referral_min_subtotal_cents").notNull().default(0),
    status: shopStatusEnum("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* uniqueIndex: един магазин на потребител в MVP */
    uniqueIndex("shops_owner_idx").on(t.ownerId),
    index("shops_status_idx").on(t.status),
  ],
).enableRLS();

export const planEnum = pgEnum("plan", ["starter", "pro"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: planEnum("plan").notNull().default("starter"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscriptions_shop_idx").on(t.shopId),
    uniqueIndex("subscriptions_customer_idx").on(t.stripeCustomerId),
  ],
).enableRLS();

/** Webhook идемпотентност: Stripe праща at-least-once → PK dedup. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export type Subscription = typeof subscriptions.$inferSelect;

export const productStatusEnum = pgEnum("product_status", ["active", "inactive"]);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("categories_shop_idx").on(t.shopId)],
).enableRLS();

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    promoPriceCents: integer("promo_price_cents"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    status: productStatusEnum("status").notNull().default("active"),
    stock: integer("stock"),
    /** Тегло в грамове (за product feed + бъдеща Еконт/Спиди тарифа). null = не е зададено. */
    weightGrams: integer("weight_grams"),
    /** Размери в милиметри (UI приема см, пази мм за десетичен вход без float). null = не е зададено. */
    lengthMm: integer("length_mm"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    /** Количество за показване, съхранено като стойност × 1000 (0.5 → 500). null = не е зададено. */
    netQuantityValue: integer("net_quantity_value"),
    /** Единица на количеството: 'mg' | 'g' | 'kg' | 'ml' | 'l'. Винаги заедно с netQuantityValue. */
    netQuantityUnit: text("net_quantity_unit"),
    /** Вътрешен артикулен код на търговеца (g:mpn във feed). null = няма. */
    sku: text("sku"),
    /** EAN/UPC баркод — валиден GTIN (g:gtin, превключва identifier_exists). null = няма. */
    gtin: text("gtin"),
    /** Марка override; null → името на магазина (сегашният feed fallback). */
    brand: text("brand"),
    /** Доставна цена в евроцентове — само за търговеца (марж). Никога публично. */
    costCents: integer("cost_cents"),
    /** SEO title override; null → продуктовото име. */
    seoTitle: text("seo_title"),
    /** SEO meta description override; null → началото на описанието. */
    seoDescription: text("seo_description"),
    /** Закачена размерна таблица; null = няма. FK set null при триене на таблицата. */
    sizeGuideId: uuid("size_guide_id").references((): AnyPgColumn => sizeGuides.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_shop_slug_idx").on(t.shopId, t.slug),
    index("products_shop_idx").on(t.shopId),
    index("products_category_idx").on(t.categoryId),
    index("products_status_idx").on(t.status),
  ],
).enableRLS();

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    value: text("value").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_attributes_product_idx").on(t.productId)],
).enableRLS();

export const productOptions = pgTable(
  "product_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    values: jsonb("values").$type<string[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_options_product_idx").on(t.productId)],
).enableRLS();

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    options: jsonb("options").$type<Record<string, string>>().notNull(),
    priceCents: integer("price_cents"),
    stock: integer("stock"),
    sku: text("sku"),
    imagePaths: jsonb("image_paths").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
).enableRLS();

export const siteSettings = pgTable(
  "site_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** Целият SiteSettings обект (Zod-валидиран при запис). */
    settings: jsonb("settings").notNull().default({}),
    /** Незапазени промени за live preview в таб „Уебсайт". */
    draft: jsonb("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("site_settings_shop_idx").on(t.shopId)],
).enableRLS();

export const shippingTypeEnum = pgEnum("shipping_type", ["courier", "pickup", "local"]);
export const paymentTypeEnum = pgEnum("payment_type", ["cod", "bank_transfer", "on_site"]);
export const orderStatusEnum = pgEnum("order_status", [
  "new",
  "confirmed",
  "shipped",
  "completed",
  "cancelled",
  /* N12: връщания — заявено от купувача → прието (върната) / отказано (обратно completed). */
  "return_requested",
  "returned",
]);

export const shippingMethods = pgTable(
  "shipping_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: shippingTypeEnum("type").notNull(),
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    /** Безплатна доставка при subtotal ≥ тази стойност (null = никога). */
    freeOverCents: integer("free_over_cents"),
    /** Опционално работно време за доставка (дни + часове) — само информация за
       клиента. Формат: WorkingHours ({ days: [{closed,open,close}×7] }). null = не се показва. */
    deliveryHours: jsonb("delivery_hours"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipping_methods_shop_idx").on(t.shopId)],
).enableRLS();

export const sizeGuides = pgTable(
  "size_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Заглавия на колоните, напр. ["Размер","Гръдна обиколка"]. */
    columns: jsonb("columns").$type<string[]>().notNull().default([]),
    /** Редове: всеки е масив с дължина = columns.length. */
    rows: jsonb("rows").$type<string[][]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("size_guides_shop_idx").on(t.shopId)],
).enableRLS();

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: paymentTypeEnum("type").notNull(),
    name: text("name").notNull(),
    /** Свободни детайли: IBAN за превод, бележки и т.н. */
    details: text("details").notNull().default(""),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_methods_shop_idx").on(t.shopId)],
).enableRLS();

/** Количествена промоция „купи N за общо X" — най-много една per продукт. */
export const promotions = pgTable(
  "promotions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    totalPriceCents: integer("total_price_cents").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("promotions_product_idx").on(t.productId),
    index("promotions_shop_idx").on(t.shopId),
  ],
).enableRLS();

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    orderNumber: integer("order_number").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email").notNull().default(""),
    address: text("address").notNull().default(""),
    city: text("city").notNull().default(""),
    note: text("note").notNull().default(""),
    /* Snapshot на методите към момента на поръчката */
    shippingName: text("shipping_name").notNull(),
    shippingPriceCents: integer("shipping_price_cents").notNull(),
    paymentName: text("payment_name").notNull(),
    paymentType: paymentTypeEnum("payment_type").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    /* Приложен промо код (snapshot) + спестена сума; празно/0 = без купон. */
    couponCode: text("coupon_code").notNull().default(""),
    discountCents: integer("discount_cents").notNull().default(0),
    /* N9: подаръчна опаковка (snapshot на таксата към момента) + картичка (независими). */
    giftWrap: boolean("gift_wrap").notNull().default(false),
    giftCard: boolean("gift_card").notNull().default(false),
    giftNote: text("gift_note").notNull().default(""),
    giftWrapFeeCents: integer("gift_wrap_fee_cents").notNull().default(0),
    /* N12: заявено връщане от купувача (причина + кога, за срока/одита). */
    returnReason: text("return_reason").notNull().default(""),
    returnRequestedAt: timestamp("return_requested_at", { withTimezone: true }),
    totalCents: integer("total_cents").notNull(),
    /* Идемпотентност на checkout: клиентът праща стабилен UUID per опит за поръчка.
       Двоен клик / retry при timeout → същият ключ → връщаме съществуващата
       поръчка вместо дубликат. NULL за ръчни поръчки (без риск от дубъл). */
    idempotencyKey: uuid("idempotency_key"),
    /* Непубличен ключ за страницата с потвърждение: URL-ът носи token, не само
       id — иначе всеки с познат orderId (UUID) вижда личните данни на клиента. */
    publicToken: uuid("public_token").notNull().defaultRandom(),
    status: orderStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_shop_number_idx").on(t.shopId, t.orderNumber),
    index("orders_shop_status_idx").on(t.shopId, t.status),
    index("orders_shop_created_idx").on(t.shopId, t.createdAt),
    /* Partial unique: два опита със същия ключ в един магазин не могат да станат
       две поръчки. WHERE idempotency_key IS NOT NULL → ръчните поръчки (NULL) не
       се засягат. */
    uniqueIndex("orders_idempotency_idx")
      .on(t.shopId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
).enableRLS();

/** Snapshot редове — оцеляват изтриване/промяна на продукта. */
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    variantKey: text("variant_key").notNull().default(""),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    /** Напр. "2 бр за 30,00 €" — как е получена сумата. */
    appliedDeal: text("applied_deal").notNull().default(""),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_product_idx").on(t.productId),
  ],
).enableRLS();

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
).enableRLS();

/** Фиксиран прозорец rate limiting (без Redis). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}).enableRLS();

/** Промо кодове за отстъпка на количката (per shop). couponTypeEnum е дефиниран горе. */

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    /** Код (uppercase). Unique per магазин. */
    code: text("code").notNull(),
    discountType: couponTypeEnum("discount_type").notNull(),
    /** Процент 1–100 (percent) ИЛИ центове (fixed). */
    discountValue: integer("discount_value").notNull(),
    /** Минимална междинна сума за прилагане (0 = без минимум). */
    minSubtotalCents: integer("min_subtotal_cents").notNull().default(0),
    /** Макс общ брой употреби (null = без лимит). */
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    /** Валиден до (null = безсрочен). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("coupons_shop_code_idx").on(t.shopId, t.code),
    index("coupons_shop_idx").on(t.shopId),
  ],
).enableRLS();

/** Newsletter абонати (double opt-in). pending → confirmed → unsubscribed. */
export const subscriberStatusEnum = pgEnum("subscriber_status", [
  "pending",
  "confirmed",
  "unsubscribed",
]);

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    status: subscriberStatusEnum("status").notNull().default("pending"),
    /** Уникален token за потвърждение/отписване по имейл линк. */
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    /* Един имейл веднъж per магазин (повторен абонамент → onConflictDoUpdate). */
    uniqueIndex("subscribers_shop_email_idx").on(t.shopId, t.email),
    index("subscribers_shop_status_idx").on(t.shopId, t.status),
    index("subscribers_token_idx").on(t.token),
  ],
).enableRLS();

/** В2: купон-базирани реферали — всеки абонат има личен реф. код (= coupons.code). */
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    /** Личен реферален код — съществува и като запис в coupons. */
    code: text("code").notNull(),
    /** Брой поръчки, направени с този код. */
    referredCount: integer("referred_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("referrals_shop_code_idx").on(t.shopId, t.code),
    index("referrals_shop_idx").on(t.shopId),
    index("referrals_subscriber_idx").on(t.subscriberId),
  ],
).enableRLS();

export type Referral = typeof referrals.$inferSelect;

/** S4: изпратени newsletter кампании — история + одит. */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    /** Реално успешно изпратени имейли. */
    recipientCount: integer("recipient_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("campaigns_shop_idx").on(t.shopId)],
).enableRLS();

/** S14: „извести ме при наличност" — чакащи имейли за изчерпани продукти. */
export const stockAlerts = pgTable(
  "stock_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** null = чака; попълва се при изпратен имейл (не се праща втори път). */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("stock_alerts_product_email_idx").on(t.productId, t.email),
    index("stock_alerts_shop_idx").on(t.shopId),
    index("stock_alerts_product_idx").on(t.productId),
  ],
).enableRLS();

/** Изоставена количка (recovery имейл). State машина: уловена → изпратена → конвертирала. */
export const abandonedCartStatusEnum = pgEnum("abandoned_cart_status", [
  "pending",
  "sent",
  "converted",
]);

/** Snapshot на един ред в изоставена количка (рендерируем в имейла). */
export interface AbandonedLine {
  productId: string;
  variantKey: string | null;
  qty: number;
  name: string;
  priceCents: number;
  imagePath: string | null;
  productSlug: string;
}

export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    lines: jsonb("lines").$type<AbandonedLine[]>().notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    status: abandonedCartStatusEnum("status").notNull().default("pending"),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("abandoned_carts_shop_email_idx").on(t.shopId, t.email),
    index("abandoned_carts_status_updated_idx").on(t.status, t.updatedAt),
  ],
).enableRLS();

export type AbandonedCart = typeof abandonedCarts.$inferSelect;

/** S1: ревюта — предварителна модерация (pending не се вижда публично). */
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved"]);

/** Q&A на продукт — въпрос влиза pending, публичен чак когато търговецът отговори. */
export const questionStatusEnum = pgEnum("question_status", ["pending", "answered"]);

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    /** 1–5 (валидира се в Zod; тук integer). */
    rating: integer("rating").notNull(),
    text: text("text").notNull().default(""),
    status: reviewStatusEnum("status").notNull().default("pending"),
    /** true = авторът е доказал покупка (телефон срещу поръчка) → бадж „Потвърдена покупка". */
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_shop_status_idx").on(t.shopId, t.status),
    index("reviews_product_status_idx").on(t.productId, t.status),
  ],
).enableRLS();

export const productQuestions = pgTable(
  "product_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Име на питащия; празно → „Купувач" в UI. */
    askerName: text("asker_name").notNull().default(""),
    question: text("question").notNull(),
    /** Отговорът на търговеца; непразен при status='answered'. */
    answer: text("answer").notNull().default(""),
    status: questionStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("product_questions_shop_status_idx").on(t.shopId, t.status),
    index("product_questions_product_status_idx").on(t.productId, t.status),
  ],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Shop = typeof shops.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
export type ShippingMethod = typeof shippingMethods.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type Promotion = typeof promotions.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type ProductOption = typeof productOptions.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type StockAlert = typeof stockAlerts.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type ProductQuestion = typeof productQuestions.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
