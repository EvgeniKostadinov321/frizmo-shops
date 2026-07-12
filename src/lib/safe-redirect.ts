/**
 * Валидира `next` redirect параметър срещу open-redirect. Безопасен = относителен
 * път (един водещ `/`, не `//`, без схема/двоеточие). Иначе fallback `/dashboard`.
 * Ползва се от OAuth callback-а и signInWithProvider.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  if (next.includes(":")) return "/dashboard";
  return next;
}
