"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z, type ZodError } from "zod";
import { db, profiles, shops } from "@/db";
import { resolvePostAuthPath } from "@/lib/auth-redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/safe-redirect";
import { sanitizeText } from "@/lib/sanitize";
import { createSupabaseServer } from "@/lib/supabase/server";
import { loginSchema, registerSchema, TERMS_VERSION } from "@/schemas/auth";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /* Имейлът чака потвърждение (нов акаунт или вход преди клик на линка). Формата
     превключва към екран „Провери имейла си"; email-ът захранва бутона за повторно изпращане. */
  needsConfirmation?: boolean;
  email?: string;
  /* true след успешно повторно изпращане — за „Изпратихме нов имейл" потвърждение. */
  resent?: boolean;
};

/**
 * Разпознава „имейлът още не е потвърден" от Supabase — устойчиво към версии:
 * новите връщат code === "email_not_confirmed"; по-старите само съобщение. Отделяме
 * този случай от истинска грешна парола, за да не подвеждаме потребителя.
 */
function isEmailNotConfirmed(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "email_not_confirmed") return true;
  return /email.*not.*confirm|confirm.*email|not.*confirmed/i.test(err.message ?? "");
}

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
    /* Суровите checkbox стойности — схемата ги нормализира (M1). */
    acceptTerms: formData.get("acceptTerms"),
    acceptMarketing: formData.get("acceptMarketing"),
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
      /* GDPR: запис на приетото съгласие (кога + коя версия) за доказуемост. */
      termsAcceptedAt: new Date(),
      termsVersion: TERMS_VERSION,
      marketingConsent: parsed.data.acceptMarketing,
    })
    .onConflictDoNothing();

  /* Когато в Supabase е включено потвърждение по имейл, signUp връща user БЕЗ сесия —
     акаунтът е неактивен, докато потребителят не кликне линка. НЕ пренасочваме към
     таблото (входът пак би се провалил); показваме екран „Провери имейла си". */
  if (!data.session) {
    return { needsConfirmation: true, email: parsed.data.email };
  }

  /* Потвърждението е изключено → сесия има веднага. Нов акаунт няма магазин. Ролята
     определя посоката (chosenRole); next пренася произхода (нов купувач от checkout → там). */
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

  if (error) {
    /* Различаваме „акаунтът съществува, но имейлът не е потвърден" от истинска грешна
       парола — иначе потребителят вижда подвеждащо „Грешен имейл или парола" и не знае,
       че трябва само да кликне линка от имейла. */
    if (isEmailNotConfirmed(error)) {
      return {
        needsConfirmation: true,
        email: parsed.data.email,
        error: "Профилът ти още не е потвърден. Провери имейла си за линка за потвърждение.",
      };
    }
    return { error: "Грешен имейл или парола." };
  }

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
/**
 * Изпраща наново имейла за потвърждение (бутон на екрана „Провери имейла си").
 * Rate-limit по имейл — иначе се превръща в спам оръжие срещу чужди пощи.
 * Отговорът е ЕДНАКЪВ при успех и при непознат имейл (без разкриване дали акаунтът
 * съществува); реалната грешка се логва само на сървъра.
 */
export async function resendConfirmation(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { error: "Невалиден имейл.", needsConfirmation: true, email };

  /* Макс 3 повторни изпращания на 15 мин за същия имейл. */
  if (!(await checkRateLimit(`resend-confirm:${email}`, 3, 900))) {
    return {
      needsConfirmation: true,
      email,
      error: "Твърде много опити. Изчакай няколко минути и опитай пак.",
    };
  }

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${h.get("host")}`;
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${base}/auth/callback` },
  });
  /* Логваме реалната причина, но на потребителя връщаме неутрален успех (anti-enumeration). */
  if (error) console.error(JSON.stringify({ evt: "resend_confirmation_failed", code: error.code }));

  return { needsConfirmation: true, email, resent: true };
}

export async function signInWithProvider(next?: string, fromRegister = false): Promise<void> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${h.get("host")}`;
  const safeNext = safeNextPath(next);

  /* GDPR: при OAuth от РЕГИСТРАЦИЯ носим флаг към callback-а — там записваме съгласието
     за новия профил. Регистрационната форма показва текст „с продължаване приемаш…" до
     бутона, така че кликването е информирано приемане. */
  const consentParam = fromRegister ? "&consent=1" : "";
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?next=${encodeURIComponent(safeNext)}${consentParam}`,
    },
  });

  if (error || !data.url) redirect("/auth/login?error=oauth");
  redirect(data.url);
}
