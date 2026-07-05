import { eq } from "drizzle-orm";
import { db, siteSettings } from "@/db";
import { defaultSiteSettings } from "@/lib/sections";
import {
  sectionSchema,
  siteSettingsSchema,
  type SiteSettings,
} from "@/schemas/site-settings";

/**
 * Толерантен parse: невалидна секция се изпуска, вместо да чупи целия сайт
 * (напр. след промяна на схема между версии).
 */
export function parseSiteSettings(value: unknown, shopName: string): SiteSettings {
  const full = siteSettingsSchema.safeParse(value);
  if (full.success) return full.data;

  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const sections = Array.isArray(raw.sections)
      ? raw.sections.filter((s) => sectionSchema.safeParse(s).success)
      : [];
    const salvaged = siteSettingsSchema.safeParse({ ...raw, sections });
    if (salvaged.success) return salvaged.data;
  }

  return defaultSiteSettings(shopName);
}

export async function getSiteSettingsRow(shopId: string) {
  return db.query.siteSettings.findFirst({ where: eq(siteSettings.shopId, shopId) });
}

/** Официалните настройки на магазина (с дефолти при липса на запис). */
export async function getSiteSettings(shopId: string, shopName: string): Promise<SiteSettings> {
  const row = await getSiteSettingsRow(shopId);
  return parseSiteSettings(row?.settings ?? null, shopName);
}

/**
 * Запазва промените като ЧЕРНОВА (само в `draft`) — клиентите продължават да
 * виждат публикуваните `settings`. Собственикът вижда draft-а в preview-то.
 * Използва се и за автоматичния live-preview запис, и за бутона „Запази“.
 */
export async function saveSiteSettingsDraft(shopId: string, draft: SiteSettings) {
  await db
    .insert(siteSettings)
    .values({ shopId, settings: {}, draft, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.shopId,
      set: { draft, updatedAt: new Date() },
    });
}

/**
 * ПУБЛИКУВА черновата: копира `draft` → `settings` и нулира `draft`.
 * От този момент клиентите виждат промените.
 */
export async function publishSiteSettings(shopId: string, settings: SiteSettings) {
  await db
    .insert(siteSettings)
    .values({ shopId, settings, draft: null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteSettings.shopId,
      set: { settings, draft: null, updatedAt: new Date() },
    });
}
