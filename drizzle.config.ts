import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Session pooler (:5432) — drizzle-kit не работи през transaction pooler
    url: process.env.DATABASE_URL_MIGRATIONS!,
  },
});
