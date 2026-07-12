import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, profiles, shops } from "@/db";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Връща auth потребителя или пренасочва към login. За Server Components/Actions. */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  return user;
}

/**
 * Идемпотентно гарантира ред в profiles (предпазна мрежа при прекъснат signup +
 * OAuth първо влизане). При OAuth подаваме името от провайдъра → записва се при
 * insert; повторно влизане не презаписва (onConflictDoNothing).
 */
export async function ensureProfile(userId: string, fullName?: string, phone?: string) {
  await db
    .insert(profiles)
    .values({
      id: userId,
      fullName: fullName ? sanitizeText(fullName, 100) : "",
      phone: phone ? sanitizeText(phone, 30) : null,
    })
    .onConflictDoNothing();
}

/** Магазинът на текущия потребител или null (за UI разклонения). */
export async function getOwnShop() {
  const user = await requireUser();
  const shop = await db.query.shops.findFirst({ where: eq(shops.ownerId, user.id) });
  return { user, shop: shop ?? null };
}

/** За мутации/страници, изискващи магазин: няма магазин → onboarding. */
export async function requireShop() {
  const { user, shop } = await getOwnShop();
  if (!shop) redirect("/dashboard/onboarding");
  return { user, shop };
}

/** За купувачки страници/мутации: auth + гарантиран profile ред (без магазин изискване). */
export async function requireBuyer() {
  const user = await requireUser();
  await ensureProfile(user.id, user.user_metadata?.full_name as string | undefined);
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.id, user.id) });
  /* ensureProfile гарантира реда; при рядка гонка findFirst пак може да върне null →
     минимален fallback със същата форма (id/fullName/phone/preferredRole/phoneVerified). */
  return {
    user,
    profile:
      profile ?? {
        id: user.id,
        fullName: "",
        phone: null,
        preferredRole: null,
        phoneVerified: false,
      },
  };
}

/** Платформен админ: имейлът е в PLATFORM_ADMIN_EMAILS; иначе 404 (без издаване). */
export async function requireAdmin() {
  const user = await requireUser();
  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !admins.includes(user.email.toLowerCase())) notFound();
  return user;
}
