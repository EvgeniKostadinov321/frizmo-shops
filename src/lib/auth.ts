import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, profiles, shops } from "@/db";
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

/** Идемпотентно гарантира ред в profiles (предпазна мрежа при прекъснат signup). */
export async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ id: userId }).onConflictDoNothing();
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
