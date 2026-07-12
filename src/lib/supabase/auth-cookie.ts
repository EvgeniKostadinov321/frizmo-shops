/**
 * Има ли Supabase auth сесия сред cookie имената. Ползва се за cookie-guard в
 * `getPublicShop` — анонимен посетител (без auth cookie) пропуска Supabase
 * `getUser()` round-trip. Нарочно широк (fail-safe): при съмнение по-добре да
 * върне true (правим round-trip), отколкото да пропусне логнат owner.
 *
 * Supabase (@supabase/ssr) ползва `sb-<project-ref>-auth-token`, chunk-нат на
 * `.0`/`.1` при големи сесии. Проверяваме `sb-` prefix + `auth-token` съдържание.
 */
export function hasSupabaseAuthCookie(cookieNames: string[]): boolean {
  return cookieNames.some((name) => name.startsWith("sb-") && name.includes("auth-token"));
}
