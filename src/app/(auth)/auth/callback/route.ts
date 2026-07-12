import { type NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * OAuth callback — Supabase връща тук след Google. Разменя `code` за сесия,
 * гарантира profiles ред (с името от провайдъра), пренасочва към валидиран `next`.
 * При липсващ code / OAuth denial / exchange грешка → login с общо съобщение.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error(JSON.stringify({ scope: "oauth-callback", error: error?.message }));
    return NextResponse.redirect(`${origin}/auth/login?error=oauth`);
  }

  /* Google дава името в user_metadata (full_name или name). */
  const meta = data.user.user_metadata as { full_name?: string; name?: string };
  await ensureProfile(data.user.id, meta.full_name ?? meta.name);

  return NextResponse.redirect(`${origin}${next}`);
}
