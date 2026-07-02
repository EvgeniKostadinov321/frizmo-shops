import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
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
  (t) => [index("shops_owner_idx").on(t.ownerId), index("shops_status_idx").on(t.status)],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;
export type Shop = typeof shops.$inferSelect;
