import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Auth callback — Supabase връща тук в два случая:
 *  1. Google OAuth → `?code=...` (PKCE) → exchangeCodeForSession.
 *  2. Потвърждение на имейл при регистрация → или `?code=...` (PKCE, същото
 *     устройство), или `?token_hash=...&type=signup` (cross-device) → verifyOtp.
 * И двата водят до сесия + гарантиран profiles ред + redirect към валидиран `next`.
 * При липса на параметри / грешка → login с общо съобщение.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));
  /* GDPR: consent=1 идва от OAuth през регистрационната форма (виж signInWithProvider).
     Записва приемане на условията за новия профил. */
  const acceptedTerms = searchParams.get("consent") === "1";

  const supabase = await createSupabaseServer();

  /* Разменяме кода/токена за сесия — според подадения формат. */
  let userId: string | null = null;
  let userMeta: { full_name?: string; name?: string } = {};
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error(JSON.stringify({ scope: "auth-callback", flow: "pkce", error: error?.message }));
      return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
    }
    userId = data.user.id;
    userMeta = data.user.user_metadata as typeof userMeta;
  } else if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    if (error || !data.user) {
      console.error(JSON.stringify({ scope: "auth-callback", flow: "otp", error: error?.message }));
      return NextResponse.redirect(`${origin}/auth/login?error=confirm`);
    }
    userId = data.user.id;
    userMeta = data.user.user_metadata as typeof userMeta;
  } else {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
  }

  /* Google дава името в user_metadata (full_name или name); при имейл потвърждение
     профилът вече е създаден при signUp, но ensureProfile е идемпотентен. */
  await ensureProfile(userId, userMeta.full_name ?? userMeta.name, undefined, acceptedTerms);

  return NextResponse.redirect(`${origin}${next}`);
}
