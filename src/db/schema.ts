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
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipping_methods_shop_idx").on(t.shopId)],
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
    totalCents: integer("total_cents").notNull(),
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
  (t) => [index("order_items_order_idx").on(t.orderId)],
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

/** Промо кодове за отстъпка на количката (per shop). */
export const couponTypeEnum = pgEnum("coupon_type", ["percent", "fixed"]);

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

/** S1: ревюта — предварителна модерация (pending не се вижда публично). */
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved"]);

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_shop_status_idx").on(t.shopId, t.status),
    index("reviews_product_status_idx").on(t.productId, t.status),
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
export type Review = typeof reviews.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
