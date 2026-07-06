import type { IconName } from "@/components/ui";

/** Съхранените соц. линкове на магазина (shops.socialLinks jsonb). */
export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  viber?: string;
}

export interface SocialItem {
  href: string;
  label: string;
  icon: IconName;
}

/* Ред на показване (по популярност за BG малки търговци). Viber е чат линк —
   ако търговецът е въвел телефон вместо URL, го превръщаме в viber:// схема. */
const ORDER: { key: keyof SocialLinks; label: string; icon: IconName }[] = [
  { key: "facebook", label: "Facebook", icon: "facebook" },
  { key: "instagram", label: "Instagram", icon: "instagram" },
  { key: "tiktok", label: "TikTok", icon: "tiktok" },
  { key: "youtube", label: "YouTube", icon: "youtube" },
  { key: "viber", label: "Viber", icon: "viber" },
];

/** Нормализира Viber стойност: пълен линк остава, телефон → viber://chat?number. */
function viberHref(raw: string): string {
  const v = raw.trim();
  if (v.startsWith("http") || v.startsWith("viber:")) return v;
  /* Телефон → чат линк (Viber иска номер без интервали, със +). */
  const cleaned = v.replace(/[^\d+]/g, "");
  return cleaned ? `viber://chat?number=${encodeURIComponent(cleaned)}` : "";
}

/**
 * Превръща shops.socialLinks в подредения списък за рендер (footer + socials
 * секция). Празните се изпускат — един източник за двете места.
 */
export function buildSocialItems(links: SocialLinks | null | undefined): SocialItem[] {
  const l = links ?? {};
  const items: SocialItem[] = [];
  for (const { key, label, icon } of ORDER) {
    const raw = (l[key] ?? "").trim();
    if (!raw) continue;
    const href = key === "viber" ? viberHref(raw) : raw;
    if (href) items.push({ href, label, icon });
  }
  return items;
}
