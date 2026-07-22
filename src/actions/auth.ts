"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodError } from "zod";
import { db, profiles, shops } from "@/db";
import { resolvePostAuthPath } from "@/lib/auth-redirect";
import { safeNextPath } from "@/lib/safe-redirect";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/schemas/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Регистрацията не бе успешна. Имейлът може вече да е зает." };
  }

  const role = parsed.data.role ?? null;
  await db
    .insert(profiles)
    .values({
      id: data.user.id,
      fullName: sanitizeText(parsed.data.fullName, 100),
      preferredRole: role,
    })
    .onConflictDoNothing();

  /* Нов акаунт няма магазин. Ролята на регистрацията определя посоката (chosenRole);
     next пренася произхода (напр. нов купувач от checkout → обратно там). */
  const next = (formData.get("next") as string | null) ?? undefined;
  redirect(resolvePostAuthPath(false, role, next, role ?? undefined));
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role") ?? undefined,
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: "Грешен имейл или парола." };

  /* Redirect: РОЛЯТА НА ДЕЙСТВИЕТО (parsed.data.role, от toggle-а/контекста) определя
     посоката и надделява над hasShop. Само при липса на явна роля падаме на
     състоянието на акаунта (магазин / preferredRole). next = откъдето е дошъл. */
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  const next = (formData.get("next") as string | null) ?? undefined;
  let hasShop = false;
  let preferredRole: "buyer" | "seller" | null = null;
  if (uid) {
    const shop = await db.query.shops.findFirst({
      where: eq(shops.ownerId, uid),
      columns: { id: true },
    });
    hasShop = Boolean(shop);
    const prof = await db.query.profiles.findFirst({
      where: eq(profiles.id, uid),
      columns: { preferredRole: true },
    });
    preferredRole = (prof?.preferredRole as "buyer" | "seller" | null) ?? null;
  }
  redirect(resolvePostAuthPath(hasShop, preferredRole, next, parsed.data.role));
}

/**
 * Изход. `redirectTo` е дестинацията след излизане — по подразбиране търговският
 * вход (/auth/login). Купувачите подават "/" (каталога), за да продължат да
 * пазаруват. Само относителни пътища (защита срещу open-redirect).
 */
export async function signOut(redirectTo = "/auth/login"): Promise<void> {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  const dest = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/auth/login";
  redirect(dest);
}

/**
 * Стартира OAuth flow (засега само Google). `next` носи дестинацията след вход —
 * търговец → /dashboard; купувачески акаунт (S3) → друг път по-късно. redirectTo
 * сочи нашия callback (виж app/(auth)/auth/callback/route.ts). base URL от заявката,
 * за да работи и на localhost, и на прод домейна.
 */
export async function signInWithProvider(next?: string): Promise<void> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${h.get("host")}`;
  const safeNext = safeNextPath(next);

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error || !data.url) redirect("/auth/login?error=oauth");
  redirect(data.url);
}
